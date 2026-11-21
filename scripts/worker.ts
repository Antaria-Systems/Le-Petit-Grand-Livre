/**
 * Worker : envois programmés, tâches d'import, traitement des documents.
 *
 * Rôle (variable WORKER_ROLE) :
 *  - « envois »    : envois programmés des demandes + tâches d'import (a besoin d'Internet et du relais SMTP) ;
 *  - « documents » : analyse et génération des versions occultées (aucun besoin d'Internet ni du SMTP) ;
 *  - « tout »      : les deux (par défaut).
 *
 * Les envois programmés tournent dans leur propre boucle (toutes les 30 s) : une longue analyse
 * de document ne les retarde jamais. Un travail interrompu (redémarrage) est repris : les étapes
 * sont idempotentes, et un document qui échoue 3 fois de suite est abandonné avec une erreur.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { traiterEnvoisProgrammes } from "../src/lib/envoi-demande";
import { importerDepartement } from "../src/lib/imports";
import { analyser, generer } from "../src/lib/traitement/pipeline";

const ROLE = (process.env.WORKER_ROLE ?? "tout") as "tout" | "envois" | "documents";
const ENVOIS = ROLE === "tout" || ROLE === "envois";
const DOCUMENTS = ROLE === "tout" || ROLE === "documents";
const PAUSE_MS = 5000;
const INTERVALLE_ENVOIS_MS = 30_000;
const TENTATIVES_MAX = 3;

let arret = false;
process.on("SIGTERM", () => (arret = true));
process.on("SIGINT", () => (arret = true));

/** Battement de cœur : affiché dans l'admin, et fichier lu par le healthcheck Docker. */
async function battement(boucle: string) {
  const maintenant = new Date().toISOString();
  await db.etat
    .upsert({ where: { cle: `battement:${boucle}` }, create: { cle: `battement:${boucle}`, valeur: maintenant }, update: { valeur: maintenant } })
    .catch((e) => console.error("[battement]", e instanceof Error ? e.message : e));
  await writeFile(`/tmp/battement-${boucle}`, maintenant).catch(() => {});
}

/** Moniteur « push » Uptime Kuma (facultatif) : une absence de signal déclenche l'alerte. */
let dernierPush = 0;
async function pushSupervision() {
  const url = process.env.KUMA_PUSH_URL;
  if (!url || Date.now() - dernierPush < 60_000) return;
  dernierPush = Date.now();
  await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => {});
}

/* ───────────── Envois programmés (boucle indépendante) ───────────── */

let envoisEnCours = false;
async function boucleEnvois() {
  if (envoisEnCours || arret) return;
  envoisEnCours = true;
  try {
    await traiterEnvoisProgrammes();
    await battement("envois");
    await pushSupervision();
  } catch (e) {
    console.error("[envoi programmé]", e);
  } finally {
    envoisEnCours = false;
  }
}

/* ───────────── Tâches d'import ───────────── */

async function tache(): Promise<boolean> {
  const t = await db.tache.findFirst({ where: { statut: "EN_ATTENTE" }, orderBy: { creeLe: "asc" } });
  if (!t) return false;
  const pris = await db.tache.updateMany({ where: { id: t.id, statut: "EN_ATTENTE" }, data: { statut: "EN_COURS", debutLe: new Date() } });
  if (pris.count !== 1) return true;
  const journal = async (ligne: string) => {
    console.log(`  [tâche ${t.id}] ${ligne}`);
    await db.$executeRaw`UPDATE "Tache" SET journal = journal || ${ligne + "\n"} WHERE id = ${t.id}`;
  };
  try {
    if (t.type === "IMPORTER_DEPARTEMENT") await importerDepartement(t.parametre, journal);
    await db.tache.update({ where: { id: t.id }, data: { statut: "TERMINEE", finLe: new Date() } });
  } catch (e) {
    await journal(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    await db.tache.update({ where: { id: t.id }, data: { statut: "ERREUR", finLe: new Date() } });
  }
  return true;
}

/** Une tâche « en cours » au démarrage a été interrompue par un redémarrage : on la libère. */
async function libererTachesInterrompues() {
  const r = await db.tache.updateMany({ where: { statut: "EN_COURS" }, data: { statut: "ERREUR", finLe: new Date() } });
  if (r.count) {
    await db.$executeRaw`UPDATE "Tache" SET journal = journal || ${"Interrompue par un redémarrage du worker : relancez l'import.\n"} WHERE statut = 'ERREUR' AND "finLe" > now() - interval '1 minute'`;
    console.log(`${r.count} tâche(s) interrompue(s) marquée(s) en erreur`);
  }
}

/* ───────────── Documents ───────────── */

async function tour(): Promise<boolean> {
  // Les générations (demandées depuis l'admin) passent avant les analyses de lots.
  const select = { id: true, titre: true, travail: true, statut: true, revision: true, tentatives: true } as const;
  const doc =
    (await db.document.findFirst({ where: { travail: "GENERER" }, orderBy: { majLe: "asc" }, select })) ??
    (await db.document.findFirst({ where: { travail: "ANALYSER" }, orderBy: { recuLe: "asc" }, select }));
  if (!doc || !doc.travail) return false;

  // Compté AVANT le traitement : un plantage (mémoire, outil bloqué) compte aussi comme un échec.
  if (doc.tentatives >= TENTATIVES_MAX) {
    await db.document.updateMany({
      where: { id: doc.id, revision: doc.revision },
      data: {
        travail: null,
        tentatives: 0,
        statut: doc.travail === "ANALYSER" ? "RECU" : doc.statut === "EN_ANALYSE" ? "A_VERIFIER" : doc.statut,
        erreur: `Traitement abandonné après ${TENTATIVES_MAX} échecs (document trop lourd ou illisible ?). Relancez l'analyse ou marquez-le non publiable.`,
      },
    });
    console.error(`  ✗ ${doc.titre} : abandon après ${TENTATIVES_MAX} échecs`);
    return true;
  }
  await db.document.update({ where: { id: doc.id }, data: { tentatives: { increment: 1 } } });

  const debut = Date.now();
  console.log(`[${doc.travail}] ${doc.titre} (${doc.id})`);
  try {
    if (doc.travail === "ANALYSER") {
      await db.document.updateMany({ where: { id: doc.id, travail: "ANALYSER", statut: { not: "NON_PUBLIABLE" } }, data: { statut: "EN_ANALYSE" } });
      await analyser(doc.id, doc.revision);
    } else {
      await generer(doc.id, doc.revision);
    }
    await db.document.update({ where: { id: doc.id }, data: { tentatives: 0 } });
    console.log(`  ✓ ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${message}`);
    // Seulement si personne n'a touché au document entre-temps.
    await db.document.updateMany({
      where: { id: doc.id, revision: doc.revision },
      data: {
        travail: null,
        tentatives: 0,
        erreur: message.slice(0, 1000),
        statut: doc.travail === "ANALYSER" ? "RECU" : doc.statut === "EN_ANALYSE" ? "A_VERIFIER" : doc.statut,
      },
    });
  }
  return true;
}

async function main() {
  console.log(`Worker démarré (rôle : ${ROLE})`);
  if (ENVOIS) {
    await libererTachesInterrompues();
    await boucleEnvois();
    setInterval(boucleEnvois, INTERVALLE_ENVOIS_MS);
  }
  while (!arret) {
    let travaille = false;
    if (DOCUMENTS) {
      travaille = await tour();
      await battement("documents");
    }
    if (!travaille && ENVOIS) travaille = await tache();
    if (!travaille) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  // Laisse un envoi en cours se terminer proprement.
  while (envoisEnCours) await new Promise((r) => setTimeout(r, 200));
  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

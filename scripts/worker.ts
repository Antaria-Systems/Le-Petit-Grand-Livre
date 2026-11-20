/**
 * Worker de traitement des documents : prend un travail en attente, l'exécute, recommence.
 * Un travail interrompu (redémarrage) reste en attente et sera repris : les étapes sont idempotentes.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { importerDepartement } from "../src/lib/imports";
import { analyser, generer } from "../src/lib/traitement/pipeline";

const PAUSE_MS = 5000;
let arret = false;
process.on("SIGTERM", () => (arret = true));
process.on("SIGINT", () => (arret = true));

/** Tâches lancées depuis l'admin (import d'un département), avec un journal consultable. */
async function tache(): Promise<boolean> {
  const t = await db.tache.findFirst({ where: { statut: "EN_ATTENTE" }, orderBy: { creeLe: "asc" } });
  if (!t) return false;
  await db.tache.update({ where: { id: t.id }, data: { statut: "EN_COURS", debutLe: new Date() } });
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

async function tour(): Promise<boolean> {
  // Les générations (demandées depuis l'admin) passent avant les analyses de lots.
  const select = { id: true, titre: true, travail: true, statut: true } as const;
  const doc =
    (await db.document.findFirst({ where: { travail: "GENERER" }, orderBy: { majLe: "asc" }, select })) ??
    (await db.document.findFirst({ where: { travail: "ANALYSER" }, orderBy: { recuLe: "asc" }, select }));
  if (!doc || !doc.travail) return false;

  const debut = Date.now();
  console.log(`[${doc.travail}] ${doc.titre} (${doc.id})`);
  try {
    if (doc.travail === "ANALYSER") {
      await db.document.update({ where: { id: doc.id }, data: { statut: "EN_ANALYSE" } });
      await analyser(doc.id);
    } else {
      await generer(doc.id);
    }
    console.log(`  ✓ ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${message}`);
    await db.document.update({
      where: { id: doc.id },
      data: {
        travail: null,
        erreur: message.slice(0, 1000),
        statut: doc.travail === "ANALYSER" ? "RECU" : doc.statut === "EN_ANALYSE" ? "A_VERIFIER" : doc.statut,
      },
    });
  }
  return true;
}

async function main() {
  console.log("Worker démarré");
  while (!arret) {
    const travaille = (await tour()) || (await tache());
    if (!travaille) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

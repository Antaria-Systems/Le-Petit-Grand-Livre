/**
 * Worker de traitement des documents : prend un travail en attente, l'exécute, recommence.
 * Un travail interrompu (redémarrage) reste en attente et sera repris : les étapes sont idempotentes.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { analyser, generer } from "../src/lib/traitement/pipeline";

const PAUSE_MS = 5000;
let arret = false;
process.on("SIGTERM", () => (arret = true));
process.on("SIGINT", () => (arret = true));

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
    const travaille = await tour();
    if (!travaille) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

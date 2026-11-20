/**
 * Supprime définitivement tous les documents d'un lot (base + fichiers chiffrés + version publique).
 *   npx tsx scripts/supprimer-lot.ts --lot "Nom du lot" [--confirmer]
 * Sans --confirmer, affiche seulement ce qui serait supprimé.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { supprimerStockage } from "../src/lib/stockage";

async function main() {
  const i = process.argv.indexOf("--lot");
  const lot = i >= 0 ? process.argv[i + 1] : undefined;
  if (!lot) throw new Error('Usage : --lot "<nom du lot>" [--confirmer]');
  const docs = await db.document.findMany({ where: { lot }, select: { id: true, titre: true, statut: true } });
  if (docs.some((d) => d.statut === "PUBLIE")) throw new Error("Ce lot contient des documents publiés : dépubliez-les d'abord.");
  console.log(`${docs.length} document(s) dans le lot « ${lot} »`);
  if (!process.argv.includes("--confirmer")) return console.log("(simulation : ajoutez --confirmer pour supprimer)");
  for (const d of docs) {
    await supprimerStockage(`originaux/${d.id}.bin`);
    await supprimerStockage(`apercus/${d.id}`);
    await supprimerStockage(`publics/${d.id}.pdf`);
    await db.document.delete({ where: { id: d.id } });
  }
  console.log("Supprimé.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

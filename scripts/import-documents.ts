/**
 * Import en ligne de commande d'un dossier de documents (PDF, images, ZIP), pour les gros lots.
 *   npx tsx scripts/import-documents.ts --commune 11199 --dossier /import [--lot "Nom du lot"]
 * Pour un dépôt courant, utiliser plutôt l'admin : /admin/depot
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { importerDepot, type ResultatImport } from "../src/lib/import-documents";

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function* fichiers(dossier: string): AsyncGenerator<string> {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(p);
    else if (e.isFile()) yield p;
  }
}

async function main() {
  const code = argument("commune");
  const dossier = argument("dossier");
  if (!code || !dossier) throw new Error("Usage : --commune <INSEE> --dossier <chemin> [--lot <nom>]");
  const commune = await db.commune.findUniqueOrThrow({ where: { code } });
  const lot = argument("lot") ?? path.basename(path.resolve(dossier));

  const tous: ResultatImport[] = [];
  for await (const f of fichiers(dossier)) {
    tous.push(...(await importerDepot({ communeCode: commune.code, lot }, path.relative(dossier, f), await readFile(f))));
  }
  const nb = (s: ResultatImport["statut"]) => tous.filter((r) => r.statut === s).length;
  console.log(`${commune.nom} : ${nb("importe")} importés, ${nb("doublon")} doublons, ${nb("ignore")} ignorés, ${nb("erreur")} erreurs`);
  for (const r of tous.filter((r) => r.statut !== "importe")) console.log(`  [${r.statut}] ${r.fichier} — ${r.message}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

/**
 * Ajoute des propositions de zones « Signature » aux documents encore à vérifier, à partir des
 * aperçus déjà stockés. Ne touche à aucune zone existante et n'ajoute rien qui chevauche déjà une zone.
 *   npx tsx scripts/detecter-signatures.ts [--confirmer]
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { lireChiffre } from "../src/lib/stockage";
import { detecterSignatures } from "../src/lib/traitement/signatures";

type R = { x: number; y: number; largeur: number; hauteur: number };
const inter = (a: R, b: R) =>
  Math.max(0, Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y));

async function main() {
  const confirmer = process.argv.includes("--confirmer");
  const docs = await db.document.findMany({ where: { statut: "A_VERIFIER", travail: null }, include: { pages: true, zones: true } });
  let ajoutees = 0;
  for (const d of docs) {
    const nouvelles: (R & { page: number })[] = [];
    for (const p of d.pages) {
      const existantes = d.zones.filter((z) => z.page === p.numero);
      for (const z of await detecterSignatures(await lireChiffre(p.cheminChiffre))) {
        if (existantes.some((e) => inter(e, z) >= 0.5 * z.largeur * z.hauteur)) continue;
        nouvelles.push({ ...z, page: p.numero });
      }
    }
    if (nouvelles.length && confirmer) {
      await db.zoneOccultation.createMany({
        data: nouvelles.map((z) => ({ documentId: d.id, page: z.page, x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur, motif: "SIGNATURE" as const, source: "AUTO" as const, validee: false })),
      });
    }
    ajoutees += nouvelles.length;
  }
  console.log(`${docs.length} documents à vérifier · ${ajoutees} zones « Signature » ${confirmer ? "ajoutées" : "seraient ajoutées (simulation)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

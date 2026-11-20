/** Évaluation du détecteur de signatures contre les zones tracées à la main (vérité terrain).
 *   npx tsx scripts/evaluer-signatures.ts [contraste=16] [--visu]   (--visu écrit des images dans /out) */
import "dotenv/config";
import sharp from "sharp";
import { db } from "../src/lib/db";
import { lireChiffre } from "../src/lib/stockage";
import { detecterSignatures } from "../src/lib/traitement/signatures";

type R = { x: number; y: number; largeur: number; hauteur: number };
const inter = (a: R, b: R) => Math.max(0, Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y));
const aire = (a: R) => a.largeur * a.hauteur;
const seuil = Number(process.argv[2] ?? 16);
const visu = process.argv.includes("--visu");

const docs = await db.document.findMany({
  where: { zones: { some: { source: "MANUEL", motif: "SIGNATURE" } } },
  include: { pages: true, zones: true },
});
let gt = 0, trouves = 0, det = 0, vrais = 0, n = 0, temps = 0;
for (const d of docs) {
  for (const p of d.pages) {
    const img = await lireChiffre(p.cheminChiffre);
    const t = Date.now();
    const zs = await detecterSignatures(img, seuil);
    temps += Date.now() - t;
    const humaines = d.zones.filter((z) => z.page === p.numero);
    const sig = humaines.filter((z) => z.source === "MANUEL" && z.motif === "SIGNATURE" && z.hauteur >= 0.025);
    gt += sig.length;
    const rates = sig.filter((g) => !zs.some((z) => inter(g, z) >= 0.4 * aire(g)));
    trouves += sig.length - rates.length;
    det += zs.length;
    const fausses = zs.filter((z) => !humaines.some((g) => inter(g, z) >= 0.2 * aire(z) || inter(g, z) >= 0.4 * aire(g)));
    vrais += zs.length - fausses.length;
    if (visu && (rates.length || fausses.length) && n < 12) {
      const W = 600, H = Math.round((W * p.hauteur) / p.largeur);
      const rect = (z: R, c: string) => `<rect x="${z.x * W}" y="${z.y * H}" width="${z.largeur * W}" height="${z.hauteur * H}" fill="none" stroke="${c}" stroke-width="3"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${humaines.map((g) => rect(g, "#0a0")).join("")}${zs.map((z) => rect(z, "#e00")).join("")}</svg>`;
      await sharp(img).resize({ width: W }).composite([{ input: Buffer.from(svg) }]).png().toFile(`/out/p${String(n++).padStart(2, "0")}.png`);
      console.log(`  visu p${n - 1} : ${d.titre} p.${p.numero} — ${rates.length} ratée(s), ${fausses.length} fausse(s)`);
    }
  }
}
console.log(`seuil ${seuil} : signatures retrouvées ${trouves}/${gt} (${Math.round((100 * trouves) / gt)} %) · détections ${det}, dont ${vrais} sur une zone humaine (${Math.round((100 * vrais) / Math.max(1, det))} %) · ${Math.round(temps / Math.max(1, docs.reduce((s, d) => s + d.pages.length, 0)))} ms/page`);
await db.$disconnect();

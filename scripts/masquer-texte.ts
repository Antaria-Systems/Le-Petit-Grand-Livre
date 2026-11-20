/**
 * Masque partout un texte resté lisible dans les versions publiques d'une commune
 * (adresse électronique, numéro…) : retrait immédiat du site, zone ajoutée exactement sur
 * les mots trouvés, régénération, puis republication automatique.
 *
 *   npx tsx scripts/masquer-texte.ts --commune 11199 --motif "luc\.mairiela.alette@" [--motif-occultation COORDONNEES_PERSO] [--confirmer]
 *
 * Sans --confirmer : liste seulement les documents et les mots concernés.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import type { MotifOccultation } from "../src/generated/prisma/enums";
import { lirePublic } from "../src/lib/stockage";
import { avecDossierTemporaire, executer } from "../src/lib/traitement/outils";

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Mot = { page: number; x: number; y: number; largeur: number; hauteur: number; texte: string };

/** Mots de la couche texte d'un PDF, avec leur position relative à la page. */
async function mots(pdf: Buffer): Promise<Mot[]> {
  return avecDossierTemporaire(async (dossier) => {
    const f = path.join(dossier, "public.pdf");
    await writeFile(f, pdf);
    const html = await executer("pdftotext", ["-bbox", f, "-"]);
    const res: Mot[] = [];
    let page = 0;
    let l = 1;
    let h = 1;
    for (const ligne of html.split("\n")) {
      const p = ligne.match(/<page width="([\d.]+)" height="([\d.]+)"/);
      if (p) {
        page++;
        l = Number(p[1]);
        h = Number(p[2]);
        continue;
      }
      const m = ligne.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)<\/word>/);
      if (m) {
        const [x0, y0, x1, y1] = m.slice(1, 5).map(Number);
        res.push({ page, x: x0 / l, y: y0 / h, largeur: (x1 - x0) / l, hauteur: (y1 - y0) / h, texte: m[5] });
      }
    }
    return res;
  });
}

async function main() {
  const commune = argument("commune");
  const motif = argument("motif");
  if (!commune || !motif) throw new Error('Usage : --commune <INSEE> --motif "<expression régulière>" [--confirmer]');
  const re = new RegExp(motif, "i");
  const motifOccultation = (argument("motif-occultation") ?? "COORDONNEES_PERSO") as MotifOccultation;
  const confirmer = process.argv.includes("--confirmer");

  const docs = await db.document.findMany({
    where: { communeCode: commune, cheminPublic: { not: null }, statut: { in: ["PUBLIE", "OCCULTE"] } },
    select: { id: true, titre: true, statut: true, cheminPublic: true },
  });
  let total = 0;
  for (const d of docs) {
    const trouves = (await mots(await lirePublic(d.cheminPublic!))).filter((m) => re.test(m.texte));
    if (trouves.length === 0) continue;
    total++;
    console.log(`${d.titre} — ${trouves.map((m) => `p.${m.page} « ${m.texte} »`).join(", ")}`);
    if (!confirmer) continue;
    const etaitPublie = d.statut === "PUBLIE";
    // 1. Retrait immédiat du site (la date de publication est conservée pour la republication).
    await db.document.update({ where: { id: d.id }, data: { statut: "A_VERIFIER" } });
    // 2. Zones exactement sur les mots, avec une marge.
    const marge = { x: 0.006, y: 0.004 };
    await db.zoneOccultation.createMany({
      data: trouves.map((m) => ({
        documentId: d.id,
        page: m.page,
        x: Math.max(0, m.x - marge.x),
        y: Math.max(0, m.y - marge.y),
        largeur: Math.min(1, m.largeur + 2 * marge.x),
        hauteur: Math.min(1, m.hauteur + 2 * marge.y),
        motif: motifOccultation,
        source: "MANUEL" as const,
        validee: true,
      })),
    });
    // 3. Régénération, puis republication automatique si le document était publié.
    await db.document.update({ where: { id: d.id }, data: { travail: "GENERER", publierApresGeneration: etaitPublie } });
  }
  console.log(`${total} document(s) ${confirmer ? "corrigé(s) : retirés du site, régénération en cours" : "concerné(s) (simulation)"}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

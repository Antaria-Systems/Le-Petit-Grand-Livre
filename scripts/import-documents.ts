/**
 * Import d'un lot de documents reçus d'une mairie.
 *   npm run import:documents -- --commune 11199 --dossier /import [--lot "Réponse CRPA 2026-11"]
 *
 * Chaque PDF est chiffré (original), dédoublonné par empreinte SHA-256, classé d'après le nom de
 * son dossier, puis mis en file pour analyse par le worker. Rien n'est publié automatiquement.
 */
import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createId } from "./id";
import { db } from "../src/lib/db";
import type { CategorieDocument } from "../src/generated/prisma/enums";
import { ecrireOriginal, sha256 } from "../src/lib/stockage";
import { normaliser } from "../src/lib/texte";

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function* pdfs(dossier: string): AsyncGenerator<string> {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) yield* pdfs(p);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) yield p;
  }
}

const CATEGORIES: [RegExp, CategorieDocument][] = [
  [/delib/, "DELIBERATION"],
  [/devis/, "DEVIS"],
  [/bons? de commande|\bbdc\b/, "BON_DE_COMMANDE"],
  [/marche/, "MARCHE"],
  [/factur/, "FACTURE"],
  [/subvention/, "SUBVENTION"],
  [/compte administratif/, "COMPTE_ADMINISTRATIF"],
  [/budget/, "BUDGET"],
  [/indemnit/, "INDEMNITES"],
  [/frais/, "FRAIS"],
  [/travaux/, "TRAVAUX"],
];

function categorie(chemin: string, racine: string): CategorieDocument {
  const relatif = normaliser(path.relative(racine, path.dirname(chemin)));
  return CATEGORIES.find(([re]) => re.test(relatif))?.[1] ?? "AUTRE";
}

/** « COLAS - FAC3293…RI26005303 - Mandat n°110 » → « COLAS, mandat n°110 ». */
export function titre(fichier: string): string {
  let t = path.basename(fichier, path.extname(fichier));
  t = t.replace(/\bPJ\d*X?FAC\w+/gi, "").replace(/\bFAC[0-9A-Z-]{10,}/gi, "");
  t = t.replace(/\s*-\s*Mandat/gi, ", mandat").replace(/\s+/g, " ");
  t = t.replace(/^[\s,-]+|[\s,-]+$/g, "").replace(/\s*-\s*,/g, ",").replace(/\s*-\s*-\s*/g, " - ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function annee(fichier: string): number | null {
  const m = path.basename(fichier).match(/\b(20[1-3]\d)\b/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const code = argument("commune");
  const dossier = argument("dossier");
  if (!code || !dossier) throw new Error("Usage : --commune <INSEE> --dossier <chemin> [--lot <nom>]");
  const commune = await db.commune.findUniqueOrThrow({ where: { code } });
  const lot = argument("lot") ?? path.basename(path.resolve(dossier));

  let importes = 0;
  const doublons: string[] = [];
  for await (const fichier of pdfs(dossier)) {
    const contenu = await readFile(fichier);
    if (contenu.subarray(0, 5).toString() !== "%PDF-") {
      console.warn(`Ignoré (pas un PDF) : ${fichier}`);
      continue;
    }
    const empreinte = sha256(contenu);
    const existant = await db.document.findUnique({
      where: { communeCode_sha256Original: { communeCode: code, sha256Original: empreinte } },
      select: { titre: true },
    });
    if (existant) {
      doublons.push(`${path.relative(dossier, fichier)}  (identique à « ${existant.titre} »)`);
      continue;
    }
    const id = createId();
    const cheminChiffre = await ecrireOriginal(id, contenu);
    await db.document.create({
      data: {
        id,
        communeCode: commune.code,
        titre: titre(fichier),
        categorie: categorie(fichier, dossier),
        annee: annee(fichier),
        statut: "RECU",
        travail: "ANALYSER",
        nomOriginal: path.relative(dossier, fichier),
        cheminChiffre,
        sha256Original: empreinte,
        typeMime: "application/pdf",
        lot,
        recuLe: (await stat(fichier)).mtime,
      },
    });
    importes++;
  }
  console.log(`${commune.nom} : ${importes} documents importés et chiffrés, ${doublons.length} doublons ignorés`);
  for (const d of doublons) console.log(`  doublon : ${d}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

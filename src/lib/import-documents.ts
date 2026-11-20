/**
 * Import de documents reçus d'une mairie : PDF, images (converties en PDF) ou archives ZIP.
 * Chaque document est chiffré à l'entrée, dédoublonné (SHA-256), classé d'après son chemin
 * et son nom, puis mis en file d'analyse. Rien n'est publié automatiquement.
 * Les archives sont décompressées EN MÉMOIRE (rien en clair sur le disque), avec des limites
 * contre les « bombes zip ».
 */
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import yauzl from "yauzl";
import type { CategorieDocument } from "../generated/prisma/enums";
import { db } from "./db";
import { createId } from "./id";
import { ecrireOriginal, sha256 } from "./stockage";
import { normaliser } from "./texte";

export const LIMITES = {
  /** Taille max d'un envoi (Cloudflare refuse au-delà de 100 Mo). */
  envoi: 100 * 1024 * 1024,
  fichier: 100 * 1024 * 1024,
  totalArchive: 600 * 1024 * 1024,
  entrees: 1000,
  profondeurArchive: 2,
};

export type ResultatImport = {
  fichier: string;
  statut: "importe" | "doublon" | "ignore" | "erreur";
  titre?: string;
  categorie?: CategorieDocument;
  message?: string;
  documentId?: string;
};

/* ─────────────── Classement ─────────────── */

const CATEGORIES: [RegExp, CategorieDocument][] = [
  [/\bdelib/, "DELIBERATION"],
  [/\bdevis\b/, "DEVIS"],
  [/bons? de commande|\bbdc\b/, "BON_DE_COMMANDE"],
  [/\bmarches?\b|\bdce\b|\bccap\b|\bcctp\b|acte d engagement/, "MARCHE"],
  [/\bfactur|\bmandat\b/, "FACTURE"],
  [/subvention/, "SUBVENTION"],
  [/compte administratif|compte financier unique|\bcfu\b/, "COMPTE_ADMINISTRATIF"],
  [/\bbudget|\bbp 20|\bdm\d?\b/, "BUDGET"],
  [/indemnit/, "INDEMNITES"],
  [/\bfrais\b|note de frais|deplacement/, "FRAIS"],
  [/travaux/, "TRAVAUX"],
];

/** Le dossier d'abord (« 6 Factures/… »), puis le nom du fichier. */
export function categorieDepuis(chemin: string): CategorieDocument {
  const dossier = normaliser(path.dirname(chemin));
  const nom = normaliser(path.basename(chemin, path.extname(chemin)));
  return CATEGORIES.find(([re]) => re.test(dossier))?.[1] ?? CATEGORIES.find(([re]) => re.test(nom))?.[1] ?? "AUTRE";
}

/** « COLAS - FAC3293…RI26005303 - Mandat n°110 » → « COLAS, mandat n°110 ». */
export function titreDepuis(fichier: string): string {
  let t = path.basename(fichier, path.extname(fichier));
  t = t.replace(/[_]+/g, " ");
  t = t.replace(/\bPJ\d*X?FAC\w+/gi, "").replace(/\bFAC[0-9A-Z-]{10,}/gi, "");
  t = t.replace(/\s*-\s*Mandat/gi, ", mandat").replace(/\s+/g, " ");
  t = t.replace(/^[\s,-]+|[\s,-]+$/g, "").replace(/\s*-\s*,/g, ",").replace(/\s*-\s*-\s*/g, " - ");
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 200) || "Document sans titre";
}

export function anneeDepuis(fichier: string): number | null {
  const m = path.basename(fichier).match(/(?<!\d)(20[1-3]\d)(?!\d)/);
  return m ? Number(m[1]) : null;
}

/* ─────────────── Détection du format ─────────────── */

type Format = "pdf" | "zip" | "image" | "bureautique" | "inconnu";

const BUREAUTIQUE = new Set([".doc", ".docx", ".odt", ".rtf", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp", ".msg", ".eml", ".txt"]);

function format(nom: string, contenu: Buffer): Format {
  const ext = path.extname(nom).toLowerCase();
  if (BUREAUTIQUE.has(ext)) return "bureautique"; // .docx/.xlsx sont aussi des ZIP : on tranche par l'extension
  // ZIP d'abord : une archive non compressée contient les octets bruts (« %PDF- ») de ses fichiers.
  if (contenu.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "zip";
  if (contenu.subarray(0, 1024).includes("%PDF-")) return "pdf";
  const debut = contenu.subarray(0, 12);
  if (debut[0] === 0xff && debut[1] === 0xd8 && debut[2] === 0xff) return "image"; // JPEG
  if (debut.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image"; // PNG
  if (debut.subarray(0, 4).toString("latin1") === "II*\0" || debut.subarray(0, 4).toString("latin1") === "MM\0*") return "image"; // TIFF
  if (debut.subarray(0, 4).toString() === "RIFF" && debut.subarray(8, 12).toString() === "WEBP") return "image";
  return "inconnu";
}

const IGNORES = /(^|\/)(__MACOSX\/|\._|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;

/** Image (scan, photo) → PDF d'une page A4, orientée d'après l'EXIF. */
async function imageEnPdf(contenu: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(contenu, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(data);
  const [l, h] = info.width > info.height ? [841.89, 595.28] : [595.28, 841.89];
  const echelle = Math.min(l / info.width, h / info.height);
  const page = pdf.addPage([l, h]);
  page.drawImage(image, { x: (l - info.width * echelle) / 2, y: (h - info.height * echelle) / 2, width: info.width * echelle, height: info.height * echelle });
  return Buffer.from(await pdf.save());
}

/* ─────────────── Archives ZIP ─────────────── */

function ouvrirZip(contenu: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((ok, ko) =>
    yauzl.fromBuffer(contenu, { lazyEntries: true, validateEntrySizes: true, strictFileNames: false, decodeStrings: true }, (e, z) => (e ? ko(e) : ok(z))),
  );
}

function listerEntrees(zip: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((ok, ko) => {
    const liste: yauzl.Entry[] = [];
    zip.on("entry", (e: yauzl.Entry) => {
      liste.push(e);
      if (liste.length > LIMITES.entrees) return ko(new Error(`Archive trop volumineuse (plus de ${LIMITES.entrees} fichiers)`));
      zip.readEntry();
    });
    zip.on("end", () => ok(liste));
    zip.on("error", ko);
    zip.readEntry();
  });
}

function lireEntree(zip: yauzl.ZipFile, entree: yauzl.Entry): Promise<Buffer> {
  return new Promise((ok, ko) =>
    zip.openReadStream(entree, (err, flux) => {
      if (err) return ko(err);
      const morceaux: Buffer[] = [];
      let total = 0;
      flux.on("data", (c: Buffer) => {
        total += c.length;
        if (total > LIMITES.fichier) flux.destroy(new Error("Fichier trop volumineux dans l'archive"));
        else morceaux.push(c);
      });
      flux.on("end", () => ok(Buffer.concat(morceaux)));
      flux.on("error", ko);
    }),
  );
}

/* ─────────────── Import ─────────────── */

type Contexte = { communeCode: string; lot: string; categorieForcee?: CategorieDocument };

async function enregistrer(ctx: Contexte, chemin: string, pdf: Buffer, empreinte: string, notes?: string): Promise<ResultatImport> {
  const existant = await db.document.findUnique({
    where: { communeCode_sha256Original: { communeCode: ctx.communeCode, sha256Original: empreinte } },
    select: { titre: true },
  });
  if (existant) return { fichier: chemin, statut: "doublon", message: `Identique à « ${existant.titre} »` };

  const id = createId();
  const categorie = ctx.categorieForcee ?? categorieDepuis(chemin);
  const titre = titreDepuis(chemin);
  const cheminChiffre = await ecrireOriginal(id, pdf);
  try {
    await db.document.create({
      data: {
        id,
        communeCode: ctx.communeCode,
        titre,
        categorie,
        annee: anneeDepuis(chemin),
        statut: "RECU",
        travail: "ANALYSER",
        nomOriginal: chemin.slice(0, 500),
        cheminChiffre,
        sha256Original: empreinte,
        typeMime: "application/pdf",
        lot: ctx.lot,
        notes: notes ?? null,
      },
    });
  } catch (e) {
    // Envoi simultané du même fichier : la contrainte d'unicité tranche.
    if ((e as { code?: string }).code === "P2002") return { fichier: chemin, statut: "doublon", message: "Déjà importé" };
    throw e;
  }
  return { fichier: chemin, statut: "importe", titre, categorie, documentId: id };
}

async function importerContenu(ctx: Contexte, chemin: string, contenu: Buffer, profondeur: number): Promise<ResultatImport[]> {
  switch (format(chemin, contenu)) {
    case "pdf":
      return [await enregistrer(ctx, chemin, contenu, sha256(contenu))];
    case "image":
      // L'empreinte porte sur l'image reçue : un nouvel envoi de la même image est reconnu comme doublon.
      return [await enregistrer(ctx, chemin, await imageEnPdf(contenu), sha256(contenu), `Converti en PDF depuis l'image ${path.basename(chemin)}`)];
    case "zip":
      if (profondeur >= LIMITES.profondeurArchive) return [{ fichier: chemin, statut: "ignore", message: "Archive imbriquée trop profondément" }];
      return importerArchive(ctx, chemin, contenu, profondeur + 1);
    case "bureautique":
      return [{ fichier: chemin, statut: "ignore", message: "Document bureautique : exportez-le en PDF" }];
    default:
      return [{ fichier: chemin, statut: "ignore", message: "Format non pris en charge (PDF, images ou ZIP uniquement)" }];
  }
}

async function importerArchive(ctx: Contexte, nomArchive: string, contenu: Buffer, profondeur: number): Promise<ResultatImport[]> {
  const zip = await ouvrirZip(contenu);
  try {
    const entrees = (await listerEntrees(zip)).filter((e) => !e.fileName.endsWith("/") && !IGNORES.test(e.fileName));
    const total = entrees.reduce((s, e) => s + e.uncompressedSize, 0);
    if (total > LIMITES.totalArchive) throw new Error("Archive trop volumineuse une fois décompressée");
    const prefixe = profondeur > 1 ? `${nomArchive}/` : "";
    const resultats: ResultatImport[] = [];
    for (const e of entrees) {
      const chemin = prefixe + e.fileName;
      if (e.isEncrypted()) {
        resultats.push({ fichier: chemin, statut: "ignore", message: "Fichier protégé par mot de passe" });
        continue;
      }
      if (e.uncompressedSize > LIMITES.fichier) {
        resultats.push({ fichier: chemin, statut: "ignore", message: "Fichier trop volumineux" });
        continue;
      }
      try {
        resultats.push(...(await importerContenu(ctx, chemin, await lireEntree(zip, e), profondeur)));
      } catch (err) {
        resultats.push({ fichier: chemin, statut: "erreur", message: (err as Error).message });
      }
    }
    return resultats;
  } finally {
    zip.close();
  }
}

/** Point d'entrée : un fichier déposé (PDF, image ou ZIP). */
export async function importerDepot(ctx: Contexte, nom: string, contenu: Buffer): Promise<ResultatImport[]> {
  try {
    return await importerContenu(ctx, nom, contenu, 0);
  } catch (e) {
    return [{ fichier: nom, statut: "erreur", message: (e as Error).message }];
  }
}

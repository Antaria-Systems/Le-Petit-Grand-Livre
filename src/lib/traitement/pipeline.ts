/**
 * Pipeline d'occultation, exécuté par le worker.
 *  analyser : original chiffré → pages rendues → OCR → zones proposées + aperçus chiffrés
 *  generer  : original chiffré → pages rendues → zones validées noircies → PDF image + texte OCR
 * Les fichiers en clair ne vivent que dans un dossier temporaire (tmpfs dans le conteneur).
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { site } from "../config";
import { db } from "../db";
import { ecrireChiffre, ecrirePublic, lireOriginal, sha256, supprimerStockage } from "../stockage";
import { detecter, ibanValide } from "./detection";
import { detecterSignatures } from "./signatures";
import { avecDossierTemporaire, DPI, DPI_OCR, executer, ocr } from "./outils";

async function nombrePages(pdf: string): Promise<number> {
  const info = await executer("pdfinfo", [pdf]);
  const n = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!n) throw new Error("Nombre de pages illisible");
  return n;
}

async function rendrePage(pdf: string, dossier: string, numero: number, dpi = DPI): Promise<string> {
  const base = path.join(dossier, `p${numero}`);
  await executer("pdftoppm", ["-r", String(dpi), "-png", "-singlefile", "-f", String(numero), "-l", String(numero), pdf, base]);
  return `${base}.png`;
}

export async function analyser(id: string): Promise<void> {
  const doc = await db.document.findUniqueOrThrow({ where: { id }, include: { commune: true } });
  const exclusions = {
    telephones: doc.commune.mairieTelephone ? [doc.commune.mairieTelephone] : [],
    emails: doc.commune.mairieEmail ? [doc.commune.mairieEmail] : [],
  };
  const original = await lireOriginal(doc.cheminChiffre);

  await avecDossierTemporaire(async (dossier) => {
    const pdf = path.join(dossier, "original.pdf");
    await writeFile(pdf, original, { mode: 0o600 });
    const n = await nombrePages(pdf);

    // Nouvelle analyse : on repart des seules zones validées ou ajoutées à la main.
    await db.zoneOccultation.deleteMany({ where: { documentId: id, source: "AUTO", validee: false } });
    await db.pageDocument.deleteMany({ where: { documentId: id } });
    await supprimerStockage(`apercus/${id}`);

    for (let numero = 1; numero <= n; numero++) {
      const png = await rendrePage(pdf, dossier, numero, DPI_OCR);
      const { width = 0, height = 0 } = await sharp(png).metadata();
      const zones = [...detecter(await ocr(png, DPI_OCR), width, height, exclusions), ...(await detecterSignatures(png))];
      // Aperçu ramené à la résolution publique (les zones sont en coordonnées relatives).
      const largeurApercu = Math.round((width * DPI) / DPI_OCR);
      const apercu = await sharp(png).resize({ width: largeurApercu }).jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      const chemin = await ecrireChiffre(`apercus/${id}/${numero}.bin`, apercu.data);
      await db.pageDocument.create({
        data: { documentId: id, numero, largeur: apercu.info.width, hauteur: apercu.info.height, cheminChiffre: chemin },
      });
      if (zones.length) {
        await db.zoneOccultation.createMany({
          data: zones.map((z) => ({ ...z, documentId: id, page: numero, source: "AUTO" as const, validee: false })),
        });
      }
      await rm(png, { force: true });
    }
    await db.document.update({ where: { id }, data: { nbPages: n, statut: "A_VERIFIER", travail: null, erreur: null } });
  });
}

/** Adresses génériques d'organisations (pas des personnes) : tolérées dans les versions publiques. */
const ADRESSES_GENERIQUES =
  /^(contact|info|infos|accueil|secretariat|secretariat-general|mairie|compta|comptabilite|facturation|factures?|commercial|commerciale|services?|sav|dpo|rgpd|dataprivacy|privacy|no-?reply|administration|direction|devis|commandes?|agence|courrier)([._-][a-z0-9]+)?@/i;

/**
 * Contrôle de la version publique, sur son propre texte : une adresse électronique nominative ou
 * un IBAN encore lisible bloque la publication automatique.
 */
async function controlerVersionPublique(pdf: string, emailsAutorises: string[]): Promise<string[]> {
  const texte = await executer("pdftotext", [pdf, "-"]);
  const alertes = new Set<string>();
  for (const m of texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
    if (!ADRESSES_GENERIQUES.test(m) && !emailsAutorises.includes(m.toLowerCase())) alertes.add(m);
  }
  for (const m of texte.match(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g) ?? []) {
    if (ibanValide(m)) alertes.add(m);
  }
  return [...alertes];
}

export async function generer(id: string): Promise<void> {
  const doc = await db.document.findUniqueOrThrow({ where: { id }, include: { zones: true, commune: { select: { mairieEmail: true } } } });
  if (doc.zones.some((z) => !z.validee)) throw new Error("Des zones proposées n'ont pas encore été validées ou supprimées");
  const original = await lireOriginal(doc.cheminChiffre);

  let alertes: string[] = [];
  const pdfPublic = await avecDossierTemporaire(async (dossier) => {
    const pdf = path.join(dossier, "original.pdf");
    await writeFile(pdf, original, { mode: 0o600 });
    const n = await nombrePages(pdf);
    const images: string[] = [];

    for (let numero = 1; numero <= n; numero++) {
      const png = await rendrePage(pdf, dossier, numero);
      const { width = 0, height = 0 } = await sharp(png).metadata();
      const masques = doc.zones
        .filter((z) => z.page === numero)
        .map((z) => {
          const left = Math.max(0, Math.floor(z.x * width));
          const top = Math.max(0, Math.floor(z.y * height));
          const w = Math.max(1, Math.min(width - left, Math.ceil(z.largeur * width) + 1));
          const h = Math.max(1, Math.min(height - top, Math.ceil(z.hauteur * height) + 1));
          return { input: { create: { width: w, height: h, channels: 3 as const, background: "#000000" } }, left, top };
        });
      const jpg = path.join(dossier, `p${numero}.jpg`);
      await sharp(png).flatten({ background: "#ffffff" }).composite(masques).jpeg({ quality: 72, mozjpeg: true }).toFile(jpg);
      await rm(png, { force: true });
      images.push(jpg);
    }

    // Tesseract assemble les pages et ajoute une couche texte invisible, issue de l'image DÉJÀ occultée.
    const liste = path.join(dossier, "pages.txt");
    await writeFile(liste, images.join("\n"));
    await executer("tesseract", [liste, path.join(dossier, "public"), "-l", "fra", "--dpi", String(DPI), "pdf"]);

    const sortie = await PDFDocument.load(await readFile(path.join(dossier, "public.pdf")));
    sortie.setTitle(doc.titre);
    sortie.setProducer(site.nom);
    sortie.setCreator(site.nom);
    sortie.setAuthor("");
    sortie.setSubject("Document administratif communiqué au titre du CRPA, mentions protégées occultées");
    sortie.setKeywords([]);
    const octets = Buffer.from(await sortie.save());
    const verif = path.join(dossier, "verif.pdf");
    await writeFile(verif, octets);
    alertes = await controlerVersionPublique(verif, doc.commune.mairieEmail ? [doc.commune.mairieEmail.toLowerCase()] : []);
    return octets;
  });

  const chemin = await ecrirePublic(id, pdfPublic);
  await db.document.update({
    where: { id },
    data: {
      cheminPublic: chemin,
      sha256Public: sha256(pdfPublic),
      // « Terminer » demandé dans l'éditeur : publication dès que la version occultée existe,
      // sauf si le contrôle trouve encore des coordonnées lisibles.
      ...(alertes.length > 0
        ? { statut: "OCCULTE" as const, publierApresGeneration: false }
        : doc.publierApresGeneration
          ? { statut: "PUBLIE" as const, publieLe: doc.publieLe ?? new Date(), publierApresGeneration: false }
          : { statut: doc.statut === "PUBLIE" ? ("PUBLIE" as const) : ("OCCULTE" as const) }),
      travail: null,
      erreur: alertes.length
        ? `Contrôle avant publication : encore lisible dans la version occultée → ${alertes.join(", ")}. Masquez-le, ou publiez manuellement si c'est une coordonnée publique.`
        : null,
    },
  });
}

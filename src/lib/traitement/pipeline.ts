/**
 * Pipeline d'occultation, exécuté par le worker.
 *  analyser : original chiffré → pages rendues → OCR → zones proposées + aperçus chiffrés
 *  generer  : original chiffré → pages rendues → zones validées noircies → PDF image + texte OCR
 * Les fichiers en clair ne vivent que dans un dossier temporaire (tmpfs dans le conteneur).
 *
 * Course édition / traitement : chaque modification du document (zones, statut) incrémente sa
 * révision. Le résultat d'un traitement n'est enregistré que si la révision n'a pas changé depuis
 * son début ; sinon il est jeté (jamais de publication d'une version obsolète).
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { site } from "../config";
import { db } from "../db";
import { ecrireChiffre, ecrirePublic, lireOriginal, sha256, supprimerStockage } from "../stockage";
import { detecter, ibanValide, masquer, nirValide, REGEX_IBAN, ribValide } from "./detection";
import { detecterSignatures } from "./signatures";
import { avecDossierTemporaire, DELAI_OUTIL_MS, DPI, DPI_OCR, executer, ocr } from "./outils";

/** Au-delà, le document est refusé (un PDF de 40 Ko peut contenir 3 000 pages vides). */
export const PAGES_MAX = 500;
/** Côté maximal d'une page, en points (A0 = 3 370 pt) : au-delà, le rendu explose la mémoire. */
const COTE_MAX_PT = 3600;

type Page = { largeurPt: number; hauteurPt: number };

/** Nombre et dimensions des pages ; refuse les documents hors limites. */
async function inspecter(pdf: string): Promise<Page[]> {
  const info = await executer("pdfinfo", [pdf], 60_000);
  const n = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!n) throw new Error("Nombre de pages illisible");
  if (n > PAGES_MAX) throw new Error(`Document de ${n} pages : au-delà de ${PAGES_MAX} pages, découpez-le avant de le déposer`);
  const tailles = await executer("pdfinfo", ["-f", "1", "-l", String(n), pdf], 60_000);
  const pages: Page[] = [];
  for (const m of tailles.matchAll(/^Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/gm)) {
    pages[Number(m[1]) - 1] = { largeurPt: Number(m[2]), hauteurPt: Number(m[3]) };
  }
  for (let i = 0; i < n; i++) {
    const p = pages[i];
    if (!p) throw new Error(`Dimensions de la page ${i + 1} illisibles`);
    if (p.largeurPt > COTE_MAX_PT || p.hauteurPt > COTE_MAX_PT) throw new Error(`Page ${i + 1} trop grande (${Math.round(p.largeurPt)} × ${Math.round(p.hauteurPt)} pt, au-delà de l'A0)`);
  }
  return pages;
}

/** Rend une page en PNG et vérifie que le rendu est complet (pdftoppm peut échouer en silence). */
async function rendrePage(pdf: string, dossier: string, numero: number, page: Page, dpi = DPI): Promise<string> {
  const base = path.join(dossier, `p${numero}`);
  await executer("pdftoppm", ["-r", String(dpi), "-png", "-singlefile", "-f", String(numero), "-l", String(numero), pdf, base]);
  const png = `${base}.png`;
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const attendu = (Math.max(page.largeurPt, page.hauteurPt) / 72) * dpi;
  if (Math.max(width, height) < attendu * 0.9) throw new Error(`Rendu de la page ${numero} incomplet (${width} × ${height} px) : document illisible ou trop lourd`);
  return png;
}

export async function analyser(id: string, revisionLue: number): Promise<void> {
  const doc = await db.document.findUniqueOrThrow({ where: { id }, include: { commune: true } });
  if (doc.revision !== revisionLue) return; // modifié depuis la prise en charge : le prochain tour reprendra
  const exclusions = {
    telephones: doc.commune.mairieTelephone ? [doc.commune.mairieTelephone] : [],
    emails: doc.commune.mairieEmail ? [doc.commune.mairieEmail] : [],
  };
  const original = await lireOriginal(doc.cheminChiffre);

  await avecDossierTemporaire(async (dossier) => {
    const pdf = path.join(dossier, "original.pdf");
    await writeFile(pdf, original, { mode: 0o600 });
    const pages = await inspecter(pdf);

    // Nouvelle analyse : on repart des seules zones validées ou ajoutées à la main.
    await db.zoneOccultation.deleteMany({ where: { documentId: id, source: "AUTO", validee: false } });
    await db.pageDocument.deleteMany({ where: { documentId: id } });
    await supprimerStockage(`apercus/${id}`);

    for (let numero = 1; numero <= pages.length; numero++) {
      const png = await rendrePage(pdf, dossier, numero, pages[numero - 1], DPI_OCR);
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
    // Un document marqué « non publiable » pendant l'analyse garde ce statut.
    await db.document.updateMany({
      where: { id, revision: revisionLue, travail: "ANALYSER", statut: { not: "NON_PUBLIABLE" } },
      data: { nbPages: pages.length, statut: "A_VERIFIER", travail: null, erreur: null },
    });
    await db.document.updateMany({ where: { id, travail: "ANALYSER", statut: "NON_PUBLIABLE" }, data: { nbPages: pages.length, travail: null } });
  });
}

/** Adresses génériques d'organisations (pas des personnes) : tolérées dans les versions publiques. */
const ADRESSES_GENERIQUES =
  /^(contact|info|infos|accueil|secretariat|secretariat-general|mairie|compta|comptabilite|facturation|factures?|commercial|commerciale|services?|sav|dpo|rgpd|dataprivacy|privacy|no-?reply|administration|direction|devis|commandes?|agence|courrier)([._-][a-z0-9]+)?@/i;

const chiffres = (s: string) => s.replace(/\D/g, "");

/**
 * Contrôle de la version publique, sur son propre texte (couche OCR de l'image déjà occultée).
 * Bloquent la publication automatique : adresse électronique nominative, IBAN, RIB, numéro de
 * sécurité sociale, téléphone mobile. Les numéros fixes ne bloquent pas (tri manuel).
 * Les valeurs renvoyées sont MASQUÉES : elles sont enregistrées en base dans le message d'erreur.
 */
async function controlerVersionPublique(pdf: string, autorises: { emails: string[]; telephones: string[] }): Promise<string[]> {
  const texte = await executer("pdftotext", [pdf, "-"], 120_000);
  const alertes = new Set<string>();
  for (const m of texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
    if (!ADRESSES_GENERIQUES.test(m) && !autorises.emails.includes(m.toLowerCase())) alertes.add(`adresse ${masquer(m)}`);
  }
  for (const m of texte.match(REGEX_IBAN) ?? []) {
    if (m.replace(/[\s.]/g, "").length >= 15 && ibanValide(m)) alertes.add(`IBAN ${masquer(m)}`);
  }
  for (const m of texte.match(/\b\d{5}[\s.]?\d{5}[\s.]?[A-Z0-9]{11}[\s.]?\d{2}\b/g) ?? []) {
    if (ribValide(m)) alertes.add(`RIB ${masquer(m)}`);
  }
  for (const m of texte.match(/\b[12][\s.]?\d{2}[\s.]?\d{2}[\s.]?(?:\d{2}|2[AB])[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{2}\b/g) ?? []) {
    if (nirValide(m)) alertes.add(`n° de sécurité sociale ${masquer(m)}`);
  }
  const telsAutorises = new Set(autorises.telephones.map((t) => chiffres(t).replace(/^33/, "0")));
  for (const m of texte.match(/(?<!\d)(?:\+33\s?\(?0?\)?\s?|0)[67](?:[\s.-]?\d{2}){4}(?!\d)/g) ?? []) {
    if (!telsAutorises.has(chiffres(m).replace(/^33/, "0"))) alertes.add(`mobile ${masquer(m)}`);
  }
  return [...alertes];
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

/** Mention en pied de page : copie occultée, source, ne vaut pas original (art. 433-13 2° C. pén.). */
function mentionPied(commune: string, publieLe: Date): string {
  const asso = site.asso.nom ? ` (association ${site.asso.nom})` : "";
  return `Copie occultée publiée par ${site.nom}${asso} le ${formatJour.format(publieLe)}, à partir d'un document communiqué par la mairie de ${commune}. Ne vaut pas original.`;
}

export async function generer(id: string, revisionLue: number): Promise<void> {
  const doc = await db.document.findUniqueOrThrow({
    where: { id },
    include: { zones: true, commune: { select: { nom: true, mairieEmail: true, mairieTelephone: true } } },
  });
  if (doc.revision !== revisionLue || doc.travail !== "GENERER") return;
  if (doc.zones.some((z) => !z.validee)) throw new Error("Des zones proposées n'ont pas encore été validées ou supprimées");
  const original = await lireOriginal(doc.cheminChiffre);

  let alertes: string[] = [];
  const pdfPublic = await avecDossierTemporaire(async (dossier) => {
    const pdf = path.join(dossier, "original.pdf");
    await writeFile(pdf, original, { mode: 0o600 });
    const pages = await inspecter(pdf);
    const images: string[] = [];

    for (let numero = 1; numero <= pages.length; numero++) {
      const png = await rendrePage(pdf, dossier, numero, pages[numero - 1]);
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
    await executer("tesseract", [liste, path.join(dossier, "public"), "-l", "fra", "--dpi", String(DPI), "pdf"], DELAI_OUTIL_MS + pages.length * 60_000);

    const sortie = await PDFDocument.load(await readFile(path.join(dossier, "public.pdf")));
    const police = await sortie.embedFont(StandardFonts.Helvetica);
    let mention = mentionPied(doc.commune.nom, doc.publieLe ?? new Date());
    try {
      police.encodeText(mention);
    } catch {
      // Caractère hors de l'encodage WinAnsi (nom de commune exotique) : on retire les diacritiques.
      mention = mention.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
    }
    for (const page of sortie.getPages()) {
      const { width } = page.getSize();
      const taille = Math.min(6, (width - 16) / police.widthOfTextAtSize(mention, 1));
      page.drawText(mention, { x: 8, y: 3, size: taille, font: police, color: rgb(0.35, 0.35, 0.35) });
    }
    sortie.setTitle(doc.titre);
    sortie.setProducer(site.nom);
    sortie.setCreator(site.nom);
    sortie.setAuthor("");
    sortie.setSubject("Copie occultée d'un document administratif communiqué au titre du CRPA, mentions protégées occultées");
    sortie.setKeywords([]);
    const octets = Buffer.from(await sortie.save());
    const verif = path.join(dossier, "verif.pdf");
    await writeFile(verif, octets);
    alertes = await controlerVersionPublique(verif, {
      emails: doc.commune.mairieEmail ? [doc.commune.mairieEmail.toLowerCase()] : [],
      telephones: doc.commune.mairieTelephone ? [doc.commune.mairieTelephone] : [],
    });
    return octets;
  });

  // Nouveau fichier à chaque génération : l'ancien reste servi tant que la base n'a pas basculé.
  const chemin = await ecrirePublic(id, pdfPublic, `r${revisionLue}-${Date.now().toString(36)}`);
  const publier = alertes.length === 0 && doc.publierApresGeneration;
  const r = await db.document.updateMany({
    // Rien n'a changé depuis le début de la génération, et le document n'a pas été écarté.
    where: { id, revision: revisionLue, travail: "GENERER", statut: { not: "NON_PUBLIABLE" } },
    data: {
      cheminPublic: chemin,
      sha256Public: sha256(pdfPublic),
      // « Terminer » demandé dans l'éditeur : publication dès que la version occultée existe,
      // sauf si le contrôle trouve encore des coordonnées lisibles.
      ...(alertes.length > 0
        ? { statut: "OCCULTE" as const, publierApresGeneration: false }
        : publier
          ? { statut: "PUBLIE" as const, publieLe: doc.publieLe ?? new Date(), publierApresGeneration: false }
          : { statut: doc.statut === "PUBLIE" ? ("PUBLIE" as const) : ("OCCULTE" as const) }),
      travail: null,
      erreur: alertes.length
        ? `Bloqué par le contrôle avant publication : encore lisible dans la version occultée → ${alertes.join(", ")}. Masquez-le, ou publiez manuellement si c'est une coordonnée publique.`
        : null,
    },
  });
  if (r.count !== 1) {
    // Modifié pendant la génération : cette version est jetée, le document reste à vérifier.
    await supprimerStockage(chemin).catch(() => {});
    return;
  }
  if (doc.cheminPublic && doc.cheminPublic !== chemin) await supprimerStockage(doc.cheminPublic).catch(() => {});
}

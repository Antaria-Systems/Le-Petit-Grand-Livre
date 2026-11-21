import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Résolution des aperçus et des PDF publics. */
export const DPI = 200;
/** Résolution de l'OCR de détection : à 200 dpi, des petits textes (en-têtes en italique) sont manqués. */
export const DPI_OCR = 300;

/** Délai maximal par défaut d'un outil externe (une page) : au-delà, il est tué. */
export const DELAI_OUTIL_MS = 180_000;

/**
 * Lance un outil externe (pdftoppm, tesseract…) avec un délai maximal : un fichier piégé ou
 * illisible ne doit jamais bloquer le worker indéfiniment.
 */
export async function executer(cmd: string, args: string[], delaiMs = DELAI_OUTIL_MS): Promise<string> {
  try {
    const { stdout } = await exec(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: delaiMs, killSignal: "SIGKILL" });
    return stdout;
  } catch (e) {
    const err = e as { killed?: boolean; signal?: string; stderr?: string; message?: string };
    if (err.killed || err.signal === "SIGKILL") throw new Error(`${cmd} : délai de ${Math.round(delaiMs / 1000)} s dépassé, traitement interrompu`);
    throw new Error(`${cmd} : ${(err.stderr || err.message || String(e)).slice(0, 300)}`);
  }
}

/** Dossier temporaire privé, supprimé quoi qu'il arrive après usage. */
export async function avecDossierTemporaire<T>(fn: (dossier: string) => Promise<T>): Promise<T> {
  const dossier = await mkdtemp(path.join(os.tmpdir(), "doc-"));
  try {
    return await fn(dossier);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/** Rend chaque page du PDF en PNG ; renvoie les chemins triés par numéro de page. */
export async function rendrePages(pdf: string, dossier: string, dpi = DPI): Promise<string[]> {
  await executer("pdftoppm", ["-r", String(dpi), "-png", pdf, path.join(dossier, "p")]);
  const fichiers = (await readdir(dossier)).filter((f) => /^p-\d+\.png$/.test(f));
  fichiers.sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return fichiers.map((f) => path.join(dossier, f));
}

export type Mot = { texte: string; x: number; y: number; l: number; h: number; ligne: string; conf: number };

/** OCR d'une image : mots avec leur boîte englobante (sortie TSV de tesseract). */
export async function ocr(image: string, dpi = DPI): Promise<Mot[]> {
  const tsv = await executer("tesseract", [image, "stdout", "-l", "fra", "--dpi", String(dpi), "tsv"]);
  const mots: Mot[] = [];
  for (const ligne of tsv.split("\n").slice(1)) {
    const c = ligne.split("\t");
    if (c.length < 12 || c[0] !== "5") continue; // niveau 5 = mot
    const texte = c[11].trim();
    if (!texte) continue;
    mots.push({
      texte,
      x: Number(c[6]),
      y: Number(c[7]),
      l: Number(c[8]),
      h: Number(c[9]),
      ligne: `${c[2]}-${c[3]}-${c[4]}`,
      conf: Number(c[10]),
    });
  }
  return mots;
}

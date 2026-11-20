/**
 * Stockage des documents.
 *   STORAGE_DIR/originaux/<id>.bin  → original NON occulté, chiffré AES-256-GCM
 *   STORAGE_DIR/publics/<id>.pdf    → version occultée, servie au public
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAGIC = Buffer.from("ODC1"); // format : MAGIC | IV (12) | TAG (16) | données chiffrées

function racine() {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

function cle(): Buffer {
  const hex = process.env.ORIGINALS_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("ORIGINALS_KEY doit contenir 64 caractères hexadécimaux (openssl rand -hex 32)");
  return Buffer.from(hex, "hex");
}

/** Résout un chemin relatif au stockage, en refusant toute sortie du dossier. */
export function cheminStockage(relatif: string): string {
  const base = racine();
  const complet = path.resolve(base, relatif);
  if (!complet.startsWith(base + path.sep)) throw new Error("Chemin de stockage invalide");
  return complet;
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export function chiffrer(clair: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const donnees = Buffer.concat([c.update(clair), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), donnees]);
}

export function dechiffrer(blob: Buffer): Buffer {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error("Fichier chiffré non reconnu");
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const d = createDecipheriv("aes-256-gcm", cle(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

export async function ecrireOriginal(id: string, clair: Buffer): Promise<string> {
  const relatif = `originaux/${id}.bin`;
  const complet = cheminStockage(relatif);
  await mkdir(path.dirname(complet), { recursive: true, mode: 0o700 });
  await writeFile(complet, chiffrer(clair), { mode: 0o600 });
  return relatif;
}

export async function lireOriginal(relatif: string): Promise<Buffer> {
  return dechiffrer(await readFile(cheminStockage(relatif)));
}

export async function ecrirePublic(id: string, pdf: Buffer): Promise<string> {
  const relatif = `publics/${id}.pdf`;
  const complet = cheminStockage(relatif);
  await mkdir(path.dirname(complet), { recursive: true });
  await writeFile(complet, pdf);
  return relatif;
}

export async function lirePublic(relatif: string): Promise<Buffer> {
  return readFile(cheminStockage(relatif));
}

/** Écrit un fichier quelconque chiffré dans le stockage (aperçus de pages non occultées…). */
export async function ecrireChiffre(relatif: string, clair: Buffer): Promise<string> {
  const complet = cheminStockage(relatif);
  await mkdir(path.dirname(complet), { recursive: true, mode: 0o700 });
  await writeFile(complet, chiffrer(clair), { mode: 0o600 });
  return relatif;
}

export async function lireChiffre(relatif: string): Promise<Buffer> {
  return dechiffrer(await readFile(cheminStockage(relatif)));
}

export async function supprimerStockage(relatif: string): Promise<void> {
  await rm(cheminStockage(relatif), { recursive: true, force: true });
}

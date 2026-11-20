/**
 * Détection des signatures manuscrites et des tampons, sans OCR.
 *
 * Principe : sur l'image binarisée, une lettre imprimée est une petite tache compacte ; un trait de
 * signature est une composante d'encre GRANDE et CLAIRSEMÉE (une boucle qui couvre beaucoup de
 * surface avec peu de pixels), un tampon est un anneau. On écarte les filets de tableau (traits
 * droits, cadres) et l'en-tête de page (logos), puis on regroupe les morceaux voisins.
 * Comme le reste de la détection, ce sont des PROPOSITIONS à valider.
 */
import sharp from "sharp";
import type { ZoneDetectee } from "./detection";

const LARGEUR_ANALYSE = 850; // ≈ 100 dpi pour une page A4 en portrait

type Composante = { x0: number; y0: number; x1: number; y1: number; n: number; bord: number };

/** Étiquetage des composantes connexes (8-voisinage) par union-find. */
function composantes(encre: Uint8Array, l: number, h: number): Composante[] {
  const parent = new Int32Array(l * h).fill(-1);
  const trouver = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unir = (a: number, b: number) => {
    const ra = trouver(a);
    const rb = trouver(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = y * l + x;
      if (!encre[i]) continue;
      parent[i] = i;
      if (x > 0 && encre[i - 1]) unir(i, i - 1);
      if (y > 0) {
        if (encre[i - l]) unir(i, i - l);
        if (x > 0 && encre[i - l - 1]) unir(i, i - l - 1);
        if (x < l - 1 && encre[i - l + 1]) unir(i, i - l + 1);
      }
    }
  }
  const stats = new Map<number, Composante>();
  for (let i = 0; i < l * h; i++) {
    if (parent[i] < 0) continue;
    const r = trouver(i);
    const x = i % l;
    const y = (i - x) / l;
    const c = stats.get(r);
    if (c) {
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      c.n++;
    } else stats.set(r, { x0: x, x1: x, y0: y, y1: y, n: 1, bord: 0 });
  }
  // Part des pixels collés au bord de la boîte englobante : élevée pour un cadre ou un filet.
  for (let i = 0; i < l * h; i++) {
    if (parent[i] < 0) continue;
    const c = stats.get(trouver(i))!;
    const x = i % l;
    const y = (i - x) / l;
    if (x - c.x0 < 3 || c.x1 - x < 3 || y - c.y0 < 3 || c.y1 - y < 3) c.bord++;
  }
  return [...stats.values()];
}

type Boite = { x0: number; y0: number; x1: number; y1: number };

function fusionner(boites: Boite[], marge: number): Boite[] {
  const res = boites.map((b) => ({ ...b }));
  let change = true;
  while (change) {
    change = false;
    for (let i = 0; i < res.length && !change; i++) {
      for (let j = i + 1; j < res.length; j++) {
        const a = res[i];
        const b = res[j];
        if (a.x0 - marge <= b.x1 && b.x0 - marge <= a.x1 && a.y0 - marge <= b.y1 && b.y0 - marge <= a.y1) {
          res[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          res.splice(j, 1);
          change = true;
          break;
        }
      }
    }
  }
  return res;
}

/** Efface les traits droits longs (filets, cadres, soulignements) : il ne reste que l'écriture. */
function effacerTraitsDroits(encre: Uint8Array, l: number, h: number, longueur: number) {
  const efface = new Uint8Array(l * h);
  for (let y = 0; y < h; y++) {
    let debut = -1;
    for (let x = 0; x <= l; x++) {
      const on = x < l && encre[y * l + x];
      if (on && debut < 0) debut = x;
      if (!on && debut >= 0) {
        if (x - debut >= longueur) for (let k = debut; k < x; k++) efface[y * l + k] = 1;
        debut = -1;
      }
    }
  }
  for (let x = 0; x < l; x++) {
    let debut = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && encre[y * l + x];
      if (on && debut < 0) debut = y;
      if (!on && debut >= 0) {
        if (y - debut >= longueur) for (let k = debut; k < y; k++) efface[k * l + x] = 1;
        debut = -1;
      }
    }
  }
  for (let i = 0; i < l * h; i++) if (efface[i]) encre[i] = 0;
}

/**
 * Contraste 16 : calibré sur 65 signatures tracées à la main (scripts/evaluer-signatures.ts) —
 * 92 % retrouvées, 94 % des détections justes. Les paraphes très pâles restent à tracer à la main.
 */
export async function detecterSignatures(image: Buffer | string, contraste = 16): Promise<ZoneDetectee[]> {
  const base = sharp(image).greyscale().resize({ width: LARGEUR_ANALYSE });
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  // Fond local estimé par un flou large : l'encre est ce qui est nettement plus sombre que son voisinage.
  const fond = await base.clone().blur(12).raw().toBuffer();
  const l = info.width;
  const h = info.height;
  const encre = new Uint8Array(l * h);
  for (let i = 0; i < l * h; i++) encre[i] = fond[i] - data[i] > contraste || data[i] < 110 ? 1 : 0;
  const encreOrigine = encre.slice();
  effacerTraitsDroits(encre, l, h, Math.round(0.05 * l));

  const candidates: Boite[] = [];
  for (const c of composantes(encre, l, h)) {
    const w = c.x1 - c.x0 + 1;
    const hh = c.y1 - c.y0 + 1;
    const densite = c.n / (w * hh);
    const cy = (c.y0 + c.y1) / 2;
    if (w < 0.06 * l || w > 0.5 * l) continue; // plus grand qu'un mot, plus petit qu'un bloc entier
    if (hh < 0.02 * l || hh > 0.25 * h) continue; // pas un filet horizontal ni une colonne de tableau
    if (densite < 0.01 || densite > 0.2) continue; // clairsemé : trait manuscrit ou anneau de tampon
    if (c.bord / c.n > 0.5) continue; // cadre ou filet de tableau
    if (cy < 0.2 * h) continue; // en-tête : logos, bandeaux, illustrations
    candidates.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }

  // Chaque détection est étendue à toute l'encre d'origine qui la touche (queue de paraphe presque
  // droite effacée avec les filets, anneau complet du tampon), sauf les grands cadres de tableau.
  const origine = composantes(encreOrigine, l, h).filter((c) => c.x1 - c.x0 < 0.45 * l && c.y1 - c.y0 < 0.25 * h && c.n > 20);
  const etendues = fusionner(candidates, 0.03 * l).map((b) => {
    const r = { ...b };
    for (const c of origine) {
      if (c.x0 <= b.x1 && b.x0 <= c.x1 && c.y0 <= b.y1 && b.y0 <= c.y1) {
        r.x0 = Math.min(r.x0, c.x0);
        r.y0 = Math.min(r.y0, c.y0);
        r.x1 = Math.max(r.x1, c.x1);
        r.y1 = Math.max(r.y1, c.y1);
      }
    }
    return r;
  });

  // Marge généreuse : mieux vaut masquer un peu de blanc que laisser dépasser un bout de paraphe.
  const marge = 0.015 * l;
  return fusionner(etendues, 0.01 * l).map((b) => ({
    x: Math.max(0, (b.x0 - marge) / l),
    y: Math.max(0, (b.y0 - marge) / h),
    largeur: Math.min(1, (b.x1 - b.x0 + 2 * marge) / l),
    hauteur: Math.min(1, (b.y1 - b.y0 + 2 * marge) / h),
    motif: "SIGNATURE" as const,
  }));
}

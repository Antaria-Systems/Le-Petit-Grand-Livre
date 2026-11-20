/**
 * Détection automatique des mentions à occulter dans le texte OCR.
 * Tout ce qui est détecté est PROPOSÉ (zone non validée) : la validation reste humaine.
 * Les signatures et les noms de personnes privées ne sont pas détectables ici :
 * ils sont ajoutés à la main dans l'interface.
 */
import type { MotifOccultation } from "../../generated/prisma/enums";
import type { Mot } from "./outils";

export type ZoneDetectee = { x: number; y: number; largeur: number; hauteur: number; motif: MotifOccultation };

type Regle = { motif: MotifOccultation; regex: RegExp; groupe?: number; filtre?: (m: string, ligne: string) => boolean };

const chiffres = (s: string) => s.replace(/\D/g, "");

/** Clé de contrôle IBAN (mod 97), pour écarter les références de facture qui y ressemblent. */
export function ibanValide(brut: string): boolean {
  const iban = brut.replace(/[\s.]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const reordonne = iban.slice(4) + iban.slice(0, 4);
  let reste = 0;
  for (const c of reordonne) {
    const v = c >= "A" ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) reste = (reste * 10 + Number(d)) % 97;
  }
  return reste === 1;
}

/** Coordonnées publiques à ne pas masquer (mairie). */
export type Exclusions = { telephones: string[]; emails: string[] };

function regles(ex: Exclusions): Regle[] {
  const tels = new Set(ex.telephones.map((t) => chiffres(t).replace(/^33/, "0")));
  const mails = new Set(ex.emails.map((e) => e.toLowerCase()));
  return [
    // IBAN : clé valide, ou mention bancaire sur la même ligne (l'OCR peut abîmer un chiffre).
    // ≥ 15 caractères utiles : exclut les n° de TVA intracommunautaire, publics.
    {
      motif: "DONNEES_BANCAIRES",
      regex: /\b[A-Z]{2}\s?\d{2}(?:[\s.]?[A-Z0-9]{2,4}){3,8}\b/g,
      filtre: (m, ligne) =>
        m.replace(/[\s.]/g, "").length >= 15 && (ibanValide(m) || /\b(IBAN|I\.B\.A\.N|RIB|R\.I\.B|BIC|banque|domiciliation)\b/i.test(ligne)),
    },
    // BIC / SWIFT
    { motif: "DONNEES_BANCAIRES", regex: /\b(?:BIC|SWIFT)\s*[:.]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi, groupe: 1 },
    // RIB : banque (5) guichet (5) compte (11) clé (2)
    { motif: "DONNEES_BANCAIRES", regex: /\b\d{5}\s+\d{5}\s+[A-Z0-9]{11}\s+\d{2}\b/g },
    // Téléphones (hors mairie)
    {
      motif: "COORDONNEES_PERSO",
      regex: /(?<![\d])(?:\+33\s?\(?0?\)?\s?|0)[1-9](?:[\s.\-]?\d{2}){4}(?![\d])/g,
      filtre: (m) => !tels.has(chiffres(m).replace(/^33/, "0")),
    },
    // Adresses électroniques (hors mairie)
    {
      motif: "COORDONNEES_PERSO",
      regex: /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi,
      filtre: (m) => !mails.has(m.toLowerCase()),
    },
  ];
}

/** Regroupe les mots par ligne OCR, en mémorisant la position de chaque mot dans le texte de la ligne. */
function lignes(mots: Mot[]) {
  const parLigne = new Map<string, Mot[]>();
  for (const m of mots) {
    if (!parLigne.has(m.ligne)) parLigne.set(m.ligne, []);
    parLigne.get(m.ligne)!.push(m);
  }
  return [...parLigne.values()].map((ms) => {
    let texte = "";
    const positions = ms.map((m) => {
      const debut = texte.length;
      texte += (texte ? " " : "") + m.texte;
      return { mot: m, debut: debut + (debut ? 1 : 0), fin: texte.length };
    });
    return { texte, positions };
  });
}

export function detecter(mots: Mot[], largeurPage: number, hauteurPage: number, ex: Exclusions): ZoneDetectee[] {
  const zones: ZoneDetectee[] = [];
  const marge = { x: 0.004 * largeurPage, y: 0.003 * hauteurPage };
  for (const { texte, positions } of lignes(mots)) {
    for (const r of regles(ex)) {
      for (const m of texte.matchAll(r.regex)) {
        const valeur = r.groupe ? m[r.groupe] : m[0];
        if (!valeur || (r.filtre && !r.filtre(valeur, texte))) continue;
        const debut = (m.index ?? 0) + (r.groupe ? m[0].indexOf(valeur) : 0);
        const fin = debut + valeur.length;
        const concernes = positions.filter((p) => p.debut < fin && p.fin > debut).map((p) => p.mot);
        if (concernes.length === 0) continue;
        const x0 = Math.min(...concernes.map((w) => w.x)) - marge.x;
        const y0 = Math.min(...concernes.map((w) => w.y)) - marge.y;
        const x1 = Math.max(...concernes.map((w) => w.x + w.l)) + marge.x;
        const y1 = Math.max(...concernes.map((w) => w.y + w.h)) + marge.y;
        zones.push({
          x: Math.max(0, x0 / largeurPage),
          y: Math.max(0, y0 / hauteurPage),
          largeur: Math.min(1, (x1 - x0) / largeurPage),
          hauteur: Math.min(1, (y1 - y0) / hauteurPage),
          motif: r.motif,
        });
      }
    }
  }
  return fusionner(zones);
}

/** Supprime les doublons (zones presque identiques détectées par deux règles). */
function fusionner(zones: ZoneDetectee[]): ZoneDetectee[] {
  const res: ZoneDetectee[] = [];
  for (const z of zones) {
    const doublon = res.find((r) => Math.abs(r.x - z.x) < 0.005 && Math.abs(r.y - z.y) < 0.005 && Math.abs(r.largeur - z.largeur) < 0.01);
    if (!doublon) res.push(z);
  }
  return res;
}

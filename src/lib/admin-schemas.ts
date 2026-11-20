import { z } from "zod";

export const MOTIFS = [
  "DONNEES_BANCAIRES",
  "COORDONNEES_PERSO",
  "SIGNATURE",
  "VIE_PRIVEE",
  "APPRECIATION_PERSONNE",
  "SECRET_AFFAIRES",
  "AUTRE",
] as const;

export const CATEGORIES = [
  "BUDGET",
  "COMPTE_ADMINISTRATIF",
  "DELIBERATION",
  "INDEMNITES",
  "FRAIS",
  "DEVIS",
  "BON_DE_COMMANDE",
  "FACTURE",
  "MARCHE",
  "SUBVENTION",
  "TRAVAUX",
  "AUTRE",
] as const;

const fraction = z.number().min(0).max(1);
export const schemaRect = z.object({ x: fraction, y: fraction, largeur: fraction, hauteur: fraction });

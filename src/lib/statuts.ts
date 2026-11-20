import type { CategorieDocument, MotifOccultation, StatutDemande, StatutDocument } from "../generated/prisma/enums";

export const STATUT_DEMANDE: Record<StatutDemande, { libelle: string; classe: string }> = {
  BROUILLON: { libelle: "Brouillon", classe: "" },
  ENVOYEE: { libelle: "En attente de réponse", classe: "badge-attente" },
  RELANCEE: { libelle: "Relancée", classe: "badge-attente" },
  REFUS_IMPLICITE: { libelle: "Sans réponse (refus implicite)", classe: "badge-alerte" },
  REFUS_EXPRES: { libelle: "Refusée", classe: "badge-alerte" },
  CADA_SAISIE: { libelle: "CADA saisie", classe: "badge-attente" },
  REPONSE_PARTIELLE: { libelle: "Réponse partielle", classe: "badge-attente" },
  SATISFAITE: { libelle: "Documents reçus", classe: "badge-ok" },
  ABANDONNEE: { libelle: "Abandonnée", classe: "" },
};

export const CATEGORIE_DOCUMENT: Record<CategorieDocument, string> = {
  BUDGET: "Budget",
  COMPTE_ADMINISTRATIF: "Compte administratif",
  DELIBERATION: "Délibération",
  INDEMNITES: "Indemnités des élus",
  FRAIS: "Frais des élus",
  DEVIS: "Devis",
  BON_DE_COMMANDE: "Bon de commande",
  FACTURE: "Facture",
  SUBVENTION: "Subvention",
  TRAVAUX: "Travaux",
  MARCHE: "Marché public",
  AUTRE: "Autre",
};

export const STATUT_DOCUMENT: Record<StatutDocument, { libelle: string; classe: string }> = {
  RECU: { libelle: "Reçu, en file d'analyse", classe: "" },
  EN_ANALYSE: { libelle: "Analyse en cours", classe: "badge-attente" },
  A_VERIFIER: { libelle: "À vérifier", classe: "badge-alerte" },
  OCCULTE: { libelle: "Occulté, prêt à publier", classe: "badge-accent" },
  PUBLIE: { libelle: "Publié", classe: "badge-ok" },
  NON_PUBLIABLE: { libelle: "Non publiable", classe: "" },
};

export const MOTIF_OCCULTATION: Record<MotifOccultation, string> = {
  DONNEES_BANCAIRES: "Données bancaires",
  COORDONNEES_PERSO: "Coordonnées personnelles",
  SIGNATURE: "Signature",
  VIE_PRIVEE: "Vie privée",
  APPRECIATION_PERSONNE: "Appréciation sur une personne",
  SECRET_AFFAIRES: "Secret des affaires",
  AUTRE: "Autre",
};

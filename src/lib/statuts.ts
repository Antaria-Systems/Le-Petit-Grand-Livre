import type { CategorieDocument, StatutDemande } from "../generated/prisma/enums";

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
  TRAVAUX: "Travaux",
  MARCHE: "Marché public",
  AUTRE: "Autre",
};

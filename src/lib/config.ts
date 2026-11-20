/** Configuration publique de la plateforme, lue depuis l'environnement. */
export const site = {
  nom: process.env.SITE_NAME ?? "Plateforme",
  url: process.env.SITE_URL ?? "http://localhost:3000",
  asso: {
    nom: process.env.ASSO_NOM ?? "",
    rna: process.env.ASSO_RNA ?? "",
    siren: process.env.ASSO_SIREN ?? "",
    adresse: process.env.ASSO_ADRESSE ?? "",
    email: process.env.ASSO_EMAIL ?? "",
  },
  directeurPublication: process.env.DIRECTEUR_PUBLICATION ?? "",
  hebergeur: process.env.HEBERGEUR ?? "",
};

export function departementsActifs(): string[] {
  return (process.env.DEPARTEMENTS_ACTIFS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

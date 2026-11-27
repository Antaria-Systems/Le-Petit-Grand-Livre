/**
 * Référencement : métadonnées des pages, aperçus de partage et données structurées (schema.org).
 * Fonctions pures (sans base), testées dans tests/seo.test.ts.
 */
import type { Metadata } from "next";
import { site } from "./config";
import { formatEntier, formatEurosCompact } from "./format";

/** Adresse absolue d'un chemin du site (« /communes/x » → « https://…/communes/x »). */
export const urlAbsolue = (chemin: string) => new URL(chemin, site.url).toString();

/**
 * Image de partage par défaut (src/app/opengraph-image.tsx). À redonner explicitement : un objet
 * openGraph propre à la page efface l'image héritée de la racine. Mais une image donnée ici
 * remplacerait aussi celle du dossier (fiche, département) : ces pages passent imageDuDossier.
 */
const IMAGE_PAR_DEFAUT = { url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: "Les finances des communes, en clair" };

/**
 * Métadonnées d'une page publique : titre, description, adresse canonique et aperçu de partage
 * (Open Graph pour Facebook, Discord, LinkedIn, WhatsApp, Telegram… ; grande carte pour X, Slack…).
 * Next.js remplace l'objet openGraph du parent au lieu de le fusionner : tout est donc repris ici.
 */
export function metadonnees({
  titre,
  titrePartage,
  description,
  chemin,
  indexer = true,
  imageDuDossier = false,
}: {
  /** Titre de l'onglet et des résultats de recherche (le nom du site est ajouté par le modèle du layout). */
  titre: string;
  /** Titre de l'aperçu de partage, si différent (le nom du site y figure déjà, à part). */
  titrePartage?: string;
  description: string;
  chemin: string;
  indexer?: boolean;
  /** La page a sa propre image (fichier opengraph-image.tsx dans son dossier). */
  imageDuDossier?: boolean;
}): Metadata {
  const partage = titrePartage ?? titre;
  const images = imageDuDossier ? {} : { images: [IMAGE_PAR_DEFAUT] };
  return {
    title: titre,
    description,
    alternates: { canonical: chemin },
    openGraph: { title: partage, description, url: chemin, siteName: site.nom, locale: "fr_FR", type: "website", ...images },
    twitter: { card: "summary_large_image", title: partage, description, ...images },
    ...(indexer ? {} : { robots: { index: false, follow: true } }),
  };
}

/** Données structurées JSON-LD, prêtes à placer dans une balise script (« < » échappé). */
export function jsonLd(donnees: object): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}

/**
 * Description d'une fiche pour les moteurs et les aperçus : chiffres propres à la commune en tête
 * (ce que montre le résultat de recherche), puis ce que contient la fiche.
 */
export function descriptionCommune(c: {
  nom: string;
  departement: string;
  codePostal?: string;
  population: number | null;
  annee?: number;
  depenses?: number;
  detteParHabitant?: number | null;
  nbDocuments: number;
}): string {
  const lieu = `${c.nom} (${c.codePostal ? `${c.codePostal}, ` : ""}${c.departement})${c.population ? `, ${formatEntier(c.population)} habitants` : ""}`;
  const chiffres = [
    c.depenses !== undefined ? `${formatEurosCompact(c.depenses)} de dépenses` : null,
    c.detteParHabitant !== undefined && c.detteParHabitant !== null ? `${formatEntier(c.detteParHabitant)} € de dette par habitant` : null,
  ].filter(Boolean);
  const documents = c.nbDocuments > 0 ? `${formatEntier(c.nbDocuments)} document${c.nbDocuments > 1 ? "s" : ""} de la mairie` : "documents de la mairie";
  const contenu = `Budget, impôts locaux, travaux, indemnités des élus et ${documents}.`;
  return chiffres.length && c.annee ? `${lieu} : ${chiffres.join(" et ")} en ${c.annee}. ${contenu}` : `${lieu}. ${contenu}`;
}

/** Fil d'Ariane au format schema.org (BreadcrumbList) ; null si une étape intermédiaire n'a pas de lien. */
export function filAriane(etapes: { libelle: string; href?: string }[]): object | null {
  if (etapes.slice(0, -1).some((e) => !e.href)) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: etapes.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.libelle,
      ...(e.href ? { item: urlAbsolue(e.href) } : {}),
    })),
  };
}

/** L'association éditrice, telle que décrite aux moteurs (schema.org NGO). */
export function organisation(): object {
  const a = site.asso;
  return {
    "@type": "NGO",
    "@id": `${urlAbsolue("/")}#organisation`,
    name: a.nom || site.nom,
    ...(a.site ? { url: a.site } : {}),
    logo: { "@type": "ImageObject", url: urlAbsolue("/apple-icon"), width: 180, height: 180 },
    ...(a.email ? { email: a.email } : {}),
    ...(a.telephone ? { telephone: a.telephone } : {}),
    ...(a.adresse ? { address: a.adresse } : {}),
    ...(a.siren ? { identifier: { "@type": "PropertyValue", propertyID: "SIREN", value: a.siren.replace(/\s/g, "") } } : {}),
    ...(a.site || site.codeSource ? { sameAs: [a.site, site.codeSource].filter(Boolean) } : {}),
  };
}

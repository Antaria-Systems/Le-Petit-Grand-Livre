import type { CategorieDocument, StatutOperation } from "../generated/prisma/enums";
import { db } from "./db";

export type DocumentFiche = {
  id: string;
  titre: string;
  categorie: CategorieDocument;
  date: string | null; // ISO
  annee: number | null;
  entreprise: string | null;
  objet: string | null;
  montantTTC: number | null;
  nbPages: number | null;
  copie: boolean;
  chantier: { slug: string; intitule: string } | null;
  publieLe: string | null; // ISO
};

export type Chantier = {
  slug: string;
  intitule: string;
  categorie: string | null;
  lieu: string | null;
  description: string | null;
  prestataire: string | null;
  statut: StatutOperation;
  montantVote: number | null; // TTC voté ou commandé
  montantVoteHT: number | null;
  facture: number; // somme des factures (net payé TTC), copies exclues
  nbFactures: number;
  subventions: number;
  debut: string | null;
  fin: string | null;
  documents: DocumentFiche[];
};

const n = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));

/** Documents publiés et chantiers d'une commune, avec les totaux relevés sur les pièces. */
export async function travauxCommune(code: string) {
  const [docs, operations] = await Promise.all([
    db.document.findMany({
      where: { communeCode: code, statut: "PUBLIE" },
      select: {
        id: true,
        titre: true,
        categorie: true,
        dateDocument: true,
        annee: true,
        entreprise: true,
        objet: true,
        montantTTC: true,
        nbPages: true,
        copie: true,
        publieLe: true,
        operation: { select: { slug: true, intitule: true } },
      },
    }),
    db.operation.findMany({ where: { communeCode: code } }),
  ]);

  const documents: DocumentFiche[] = docs
    .map((d) => ({
      id: d.id,
      titre: d.titre,
      categorie: d.categorie,
      date: d.dateDocument ? d.dateDocument.toISOString().slice(0, 10) : null,
      annee: d.annee,
      entreprise: d.entreprise,
      objet: d.objet,
      montantTTC: n(d.montantTTC),
      nbPages: d.nbPages,
      copie: d.copie,
      chantier: d.operation,
      publieLe: d.publieLe ? d.publieLe.toISOString() : null,
    }))
    .sort((a, b) => (b.date ?? String(b.annee ?? 0)).localeCompare(a.date ?? String(a.annee ?? 0)));

  const chantiers: Chantier[] = operations
    .map((o) => {
      const liste = documents.filter((d) => d.chantier?.slug === o.slug).sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9"));
      const factures = liste.filter((d) => d.categorie === "FACTURE" && !d.copie && d.montantTTC !== null);
      const dates = liste.map((d) => d.date).filter((d): d is string => d !== null).sort();
      return {
        slug: o.slug,
        intitule: o.intitule,
        categorie: o.categorie,
        lieu: o.lieu,
        description: o.description,
        prestataire: o.prestataire,
        statut: o.statut,
        montantVote: n(o.montantTTC),
        montantVoteHT: n(o.montantHT),
        facture: factures.reduce((s, d) => s + d.montantTTC!, 0),
        nbFactures: factures.length,
        subventions: liste.filter((d) => d.categorie === "SUBVENTION" && d.montantTTC !== null).reduce((s, d) => s + d.montantTTC!, 0),
        debut: dates[0] ?? null,
        fin: dates[dates.length - 1] ?? null,
        documents: liste,
      };
    })
    .sort((a, b) => b.facture - a.facture || (b.montantVote ?? b.montantVoteHT ?? 0) - (a.montantVote ?? a.montantVoteHT ?? 0));

  const factures = documents.filter((d) => d.categorie === "FACTURE" && !d.copie && d.montantTTC !== null);
  const annees = documents.map((d) => d.annee).filter((a): a is number => a !== null);
  // Les factures elles-mêmes : années et chantiers réellement facturés (pas les devis ni les délibérations).
  const anneesFactures = factures.map((d) => d.annee).filter((a): a is number => a !== null);
  const entreprises = new Set(documents.map((d) => d.entreprise).filter((e): e is string => Boolean(e) && e !== "Département de l'Aude"));
  return {
    documents,
    chantiers,
    totaux: {
      facture: factures.reduce((s, d) => s + d.montantTTC!, 0),
      nbFactures: factures.length,
      entreprises: entreprises.size,
      anneeMin: annees.length ? Math.min(...annees) : null,
      anneeMax: annees.length ? Math.max(...annees) : null,
      anneeMinFactures: anneesFactures.length ? Math.min(...anneesFactures) : null,
      anneeMaxFactures: anneesFactures.length ? Math.max(...anneesFactures) : null,
      nbChantiersFactures: chantiers.filter((c) => c.nbFactures > 0).length,
    },
  };
}

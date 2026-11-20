/** Demandes CRPA : courrier type, pièces demandées et calcul des délais. */
import { site } from "./config";
import { formatDateHeureCourte } from "./heure";

export const PIECES = {
  budget: "le budget primitif et le compte administratif (ou compte financier unique) de l'exercice {annee}, avec leurs annexes ;",
  indemnites: "l'état annuel des indemnités de toute nature perçues par les élus au titre de l'exercice {annee} (article L.2123-24-1-1 du CGCT) ;",
  frais: "les états de frais, notes de frais et justificatifs des remboursements accordés aux élus en {annee} (missions, déplacements, représentation) ;",
  deliberations: "les délibérations du conseil municipal adoptées en {annee} relatives aux travaux, aux marchés et aux finances ;",
  travaux: "les devis, bons de commande et factures des travaux et investissements payés en {annee} ;",
  marches: "les marchés publics et accords-cadres en cours d'exécution en {annee} et leurs pièces contractuelles (acte d'engagement, CCAP) ;",
  subventions: "les décisions d'attribution des subventions perçues par la commune en {annee}.",
} as const;

export type Piece = keyof typeof PIECES;
export const LIBELLES_PIECES: Record<Piece, string> = {
  budget: "Budget et compte administratif",
  indemnites: "État annuel des indemnités des élus",
  frais: "Frais des élus et justificatifs",
  deliberations: "Délibérations (travaux, marchés, finances)",
  travaux: "Devis, bons de commande et factures de travaux",
  marches: "Marchés publics et accords-cadres",
  subventions: "Subventions perçues",
};

export function objetDemande(nomCommune: string, annee: number) {
  return `Demande de communication de documents administratifs (CRPA) — ${nomCommune}, exercice ${annee}`;
}

export function courrierDemande(nomCommune: string, annee: number, pieces: Piece[]): string {
  const liste = pieces.map((p) => `- ${PIECES[p].replace("{annee}", String(annee))}`).join("\n");
  const signataire = site.directeurPublication || `L'association ${site.asso.nom}`;
  return `Madame, Monsieur le Maire,

Au nom de l'association ${site.asso.nom}, qui publie sur ${site.nom} (${site.url}) les finances des communes sous une forme lisible par tous, je sollicite, en application des articles L.300-1 et L.311-1 et suivants du code des relations entre le public et l'administration (CRPA), la communication des documents suivants concernant la commune de ${nomCommune} :

${liste}

Conformément à l'article L.311-9 du même code, je souhaite recevoir ces documents par courrier électronique, au format PDF, en réponse à ce message. Les mentions protégées par l'article L.311-6 (vie privée, coordonnées personnelles, données bancaires…) peuvent être occultées ; nous procédons de toute façon à cette occultation avant toute publication.

Afin de limiter la charge de vos services, nous n'adressons qu'une demande groupée par commune et par an.

En l'absence de réponse dans un délai d'un mois, cette demande sera réputée rejetée (article R.311-13 du CRPA), ce qui ouvrirait la possibilité de saisir la Commission d'accès aux documents administratifs.

Je vous remercie par avance et vous prie d'agréer, Madame, Monsieur le Maire, l'expression de mes salutations distinguées.

${signataire}
Pour l'association ${site.asso.nom}${site.asso.rna ? ` (RNA ${site.asso.rna})` : ""}
${site.nom} — ${site.url}${site.asso.email ? `\n${site.asso.email}` : ""}`;
}

export function ajouterMois(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Délais : réponse attendue sous un mois (R.311-13), puis deux mois pour saisir la CADA (R.343-1). */
export function delais(envoyeeLe: Date | null, refusExpresLe?: Date | null) {
  if (!envoyeeLe) return { echeanceReponse: null, limiteSaisineCada: null };
  const echeanceReponse = ajouterMois(envoyeeLe, 1);
  const limiteSaisineCada = ajouterMois(refusExpresLe ?? echeanceReponse, 2);
  return { echeanceReponse, limiteSaisineCada };
}

export type Alerte = { niveau: "info" | "attention" | "urgent"; texte: string };

/** Situation d'une demande à une date donnée (pour le tableau de bord). */
export function situationDemande(
  d: {
    statut: string;
    echeanceReponse: Date | null;
    limiteSaisineCada: Date | null;
    cadaSaisieLe: Date | null;
    envoiProgrammeLe?: Date | null;
    erreurEnvoi?: string | null;
  },
  maintenant = new Date(),
): Alerte | null {
  const jours = (x: Date) => Math.ceil((x.getTime() - maintenant.getTime()) / 86_400_000);
  if (d.statut === "BROUILLON") {
    if (d.erreurEnvoi) return { niveau: "urgent", texte: d.erreurEnvoi };
    if (d.envoiProgrammeLe) return { niveau: "info", texte: `Envoi programmé le ${formatDateHeureCourte(d.envoiProgrammeLe)}` };
    return null;
  }
  if ((d.statut === "ENVOYEE" || d.statut === "RELANCEE") && d.echeanceReponse) {
    const j = jours(d.echeanceReponse);
    if (j >= 0) return { niveau: j <= 7 ? "attention" : "info", texte: `Réponse attendue sous ${j} jour${j > 1 ? "s" : ""}` };
    if (d.limiteSaisineCada) {
      const k = jours(d.limiteSaisineCada);
      return k >= 0
        ? { niveau: "urgent", texte: `Sans réponse : refus implicite. CADA à saisir sous ${k} jour${k > 1 ? "s" : ""}` }
        : { niveau: "urgent", texte: "Sans réponse, délai de saisine de la CADA dépassé" };
    }
  }
  if ((d.statut === "REFUS_IMPLICITE" || d.statut === "REFUS_EXPRES") && d.limiteSaisineCada && !d.cadaSaisieLe) {
    const k = jours(d.limiteSaisineCada);
    return k >= 0 ? { niveau: "urgent", texte: `CADA à saisir sous ${k} jour${k > 1 ? "s" : ""}` } : { niveau: "urgent", texte: "Délai de saisine de la CADA dépassé" };
  }
  if (d.statut === "CADA_SAISIE") return { niveau: "info", texte: "En attente de l'avis de la CADA" };
  return null;
}

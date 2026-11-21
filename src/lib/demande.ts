/** Demandes CRPA : courrier type, pièces demandées et calcul des délais. */
import { site } from "./config";
import { formatDateHeureCourte } from "./heure";

export const PIECES = {
  budget: "le budget primitif et le compte administratif (ou compte financier unique) de l'exercice {annee}, avec leurs annexes ;",
  mandats:
    "l'état des mandats émis au cours de l'exercice {annee} sur les comptes d'investissement (chapitres 20, 21 et 23), tel qu'il peut être extrait de votre logiciel comptable ;",
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
  mandats: "État des mandats d'investissement (grandes communes)",
  indemnites: "État annuel des indemnités des élus",
  frais: "Frais des élus et justificatifs",
  deliberations: "Délibérations (travaux, marchés, finances)",
  travaux: "Devis, bons de commande et factures de travaux",
  marches: "Marchés publics et accords-cadres",
  subventions: "Subventions perçues",
};

/**
 * À partir de 3 500 habitants, budgets, comptes et délibérations sont en principe publiés en ligne
 * (art. L.2131-1 et L.2313-1 du CGCT) et « toutes les factures » représenteraient des milliers de
 * pièces : risque de demande abusive (L.311-2 CRPA, CE 14/11/2018 n° 420055). On demande alors
 * l'état des mandats, qui permet ensuite de cibler les seules opérations significatives.
 */
export const SEUIL_GRANDE_COMMUNE = 3500;

export function piecesParDefaut(population: number | null | undefined): Piece[] {
  return (population ?? 0) >= SEUIL_GRANDE_COMMUNE
    ? ["mandats", "indemnites", "frais", "subventions"]
    : ["budget", "indemnites", "frais", "deliberations", "travaux", "marches", "subventions"];
}

export function objetDemande(nomCommune: string, annee: number) {
  return `Demande de communication de documents administratifs (CRPA) — ${nomCommune}, exercice ${annee}`;
}

/** Fondement juridique de la demande (le CGCT ouvre spécifiquement délibérations, budgets et comptes). */
export function paragrapheFondement(nomCommune: string, pieces: Piece[]) {
  const cgct = pieces.includes("budget") || pieces.includes("deliberations");
  return `je sollicite, en application des articles L.300-1 et L.311-1 et suivants du code des relations entre le public et l'administration (CRPA)${
    cgct ? " et, pour les délibérations, budgets et comptes, de l'article L.2121-26 du code général des collectivités territoriales" : ""
  }, la communication des documents suivants concernant la commune de ${nomCommune} :`;
}

export const PARAGRAPHE_MODALITES =
  "Conformément à l'article L.311-9 du CRPA, je souhaite recevoir ces documents par courrier électronique, au format PDF, en réponse à ce message. Si certains n'existent que sur papier, je vous remercie de me les adresser numérisés si vos moyens le permettent, ou de m'indiquer le coût de leur reproduction (article R.311-11). Les mentions non communicables au titre des articles L.311-5 et L.311-6 (vie privée, coordonnées personnelles, données bancaires, secret des affaires…) sont à occulter avant envoi (article L.311-7) ; nous vérifions en outre chaque document avant toute publication.";

export const MENTION_DEJA_PUBLIES = "Les budgets, comptes et délibérations déjà publiés sur le site internet de la commune ne sont pas demandés.";

export function listePieces(annee: number, pieces: Piece[]) {
  const liste = pieces.map((p) => `- ${PIECES[p].replace("{annee}", String(annee))}`);
  // Ponctuation : la dernière pièce se termine par un point.
  if (liste.length) liste[liste.length - 1] = liste[liste.length - 1].replace(/ ;$/, ".");
  const texte = liste.join("\n");
  return pieces.includes("mandats") && !pieces.includes("budget") && !pieces.includes("deliberations") ? `${texte}\n\n${MENTION_DEJA_PUBLIES}` : texte;
}

export function courrierDemande(nomCommune: string, annee: number, pieces: Piece[]): string {
  const signataire = site.directeurPublication || `L'association ${site.asso.nom}`;
  return `Madame, Monsieur le Maire,

Au nom de l'association ${site.asso.nom}, qui publie sur ${site.nom} (${site.url}) les finances des communes sous une forme lisible par tous, ${paragrapheFondement(nomCommune, pieces)}

${listePieces(annee, pieces)}

${PARAGRAPHE_MODALITES}

Afin de limiter la charge de vos services, nous n'adressons qu'une demande groupée par commune et par an.

En l'absence de réponse dans un délai d'un mois, cette demande sera réputée rejetée (article R.311-13 du CRPA), ce qui ouvrirait la possibilité de saisir la Commission d'accès aux documents administratifs.

Je vous remercie par avance et vous prie d'agréer, Madame, Monsieur le Maire, l'expression de mes salutations distinguées.

${signataire}
Pour l'association ${site.asso.nom}${site.asso.rna ? ` (RNA ${site.asso.rna})` : ""}
${site.nom} — ${site.url}${site.asso.email ? `\n${site.asso.email}` : ""}`;
}

/* ───────────── Délais (règle du quantième, calendrier de Paris) ───────────── */

const FUSEAU = "Europe/Paris";
const partiesParis = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" });

/** Date calendaire de Paris d'un instant : [année, mois (1-12), jour]. */
export function jourParis(d: Date): [number, number, number] {
  const [a, m, j] = partiesParis.format(d).split("-").map(Number);
  return [a, m, j];
}

/** Fin de journée (23:59:59) à Paris, pour une date calendaire. */
function finDeJourneeParis(a: number, m: number, j: number): Date {
  // 23:59:59 à Paris = 21:59:59 ou 22:59:59 UTC selon la saison : on part de 22:59:59 UTC et on corrige.
  const essai = new Date(Date.UTC(a, m - 1, j, 22, 59, 59));
  return jourParis(essai)[2] === j ? essai : new Date(Date.UTC(a, m - 1, j, 21, 59, 59));
}

/**
 * Ajoute n mois à une date calendaire de Paris. À défaut de quantième identique (31 → février),
 * le délai expire le dernier jour du mois (art. 641 CPC, appliqué par le juge administratif).
 * Renvoie la fin de cette journée, heure de Paris.
 */
export function ajouterMois(d: Date, n: number): Date {
  const [a, m, j] = jourParis(d);
  const index = a * 12 + (m - 1) + n;
  const annee = Math.floor(index / 12);
  const mois = (index % 12) + 1;
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return finDeJourneeParis(annee, mois, Math.min(j, dernier));
}

/** Délais : réponse attendue sous un mois (R.311-13), puis deux mois pour saisir la CADA (R.343-1). */
export function delais(envoyeeLe: Date | null, refusExpresLe?: Date | null) {
  if (!envoyeeLe) return { echeanceReponse: null, limiteSaisineCada: null };
  const echeanceReponse = ajouterMois(envoyeeLe, 1);
  const limiteSaisineCada = ajouterMois(refusExpresLe ?? echeanceReponse, 2);
  return { echeanceReponse, limiteSaisineCada };
}

/**
 * Après saisine de la CADA : le silence de l'administration pendant deux mois à compter de
 * l'enregistrement de la saisine vaut confirmation du refus (R.343-5), puis deux mois pour
 * saisir le tribunal administratif (R.421-1 CJA).
 */
export function delaisApresCada(cadaSaisieLe: Date) {
  const refusConfirme = ajouterMois(cadaSaisieLe, 2);
  return { refusConfirme, limiteTribunal: ajouterMois(refusConfirme, 2) };
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "2-digit", month: "2-digit", year: "numeric" });
/** « 28/02/2027 » (date de Paris) */
export const formatJourParis = (d: Date) => formatJour.format(d);

export type Alerte = { niveau: "info" | "attention" | "urgent"; texte: string };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Situation d'une demande à une date donnée (pour le tableau de bord). */
export function situationDemande(
  d: {
    statut: string;
    echeanceReponse: Date | null;
    limiteSaisineCada: Date | null;
    cadaSaisieLe: Date | null;
    avisCadaLe?: Date | null;
    envoiProgrammeLe?: Date | null;
    envoiEnCoursLe?: Date | null;
    erreurEnvoi?: string | null;
  },
  maintenant = new Date(),
): Alerte | null {
  const jours = (x: Date) => Math.ceil((x.getTime() - maintenant.getTime()) / 86_400_000);
  if (d.statut === "BROUILLON") {
    if (d.erreurEnvoi) return { niveau: "urgent", texte: d.erreurEnvoi };
    if (d.envoiEnCoursLe) return { niveau: "attention", texte: `Envoi en cours depuis le ${formatDateHeureCourte(d.envoiEnCoursLe)}` };
    if (d.envoiProgrammeLe) return { niveau: "info", texte: `Envoi programmé le ${formatDateHeureCourte(d.envoiProgrammeLe)}` };
    return null;
  }
  if ((d.statut === "ENVOYEE" || d.statut === "RELANCEE") && d.echeanceReponse) {
    const j = jours(d.echeanceReponse);
    if (j >= 0) return { niveau: j <= 7 ? "attention" : "info", texte: `Réponse attendue sous ${pluriel(j, "jour")} (au plus tard le ${formatJourParis(d.echeanceReponse)})` };
    if (d.limiteSaisineCada) {
      const k = jours(d.limiteSaisineCada);
      return k >= 0
        ? { niveau: "urgent", texte: `Sans réponse : refus implicite. CADA à saisir au plus tard le ${formatJourParis(d.limiteSaisineCada)} (${pluriel(k, "jour")})` }
        : { niveau: "urgent", texte: "Sans réponse, délai de saisine de la CADA dépassé : une nouvelle demande fera courir un nouveau délai" };
    }
  }
  if ((d.statut === "REFUS_IMPLICITE" || d.statut === "REFUS_EXPRES") && d.limiteSaisineCada && !d.cadaSaisieLe) {
    const k = jours(d.limiteSaisineCada);
    return k >= 0
      ? { niveau: "urgent", texte: `CADA à saisir au plus tard le ${formatJourParis(d.limiteSaisineCada)} (${pluriel(k, "jour")})` }
      : { niveau: "urgent", texte: "Délai de saisine de la CADA dépassé : une nouvelle demande fera courir un nouveau délai" };
  }
  if (d.statut === "CADA_SAISIE" && d.cadaSaisieLe) {
    const { refusConfirme, limiteTribunal } = delaisApresCada(d.cadaSaisieLe);
    if (jours(refusConfirme) >= 0)
      return { niveau: "info", texte: `En attente de l'avis de la CADA ; sans communication, refus confirmé le ${formatJourParis(refusConfirme)} (R.343-5)` };
    const k = jours(limiteTribunal);
    return k >= 0
      ? { niveau: "attention", texte: `Refus confirmé : recours au tribunal administratif possible jusqu'au ${formatJourParis(limiteTribunal)}` }
      : { niveau: "info", texte: "Délai de recours au tribunal administratif dépassé" };
  }
  return null;
}

/** Statut affiché : plus parlant que le statut brut (programmée, envoi en cours, délai dépassé). */
export function statutAffiche(
  d: { statut: string; envoiProgrammeLe?: Date | null; envoiEnCoursLe?: Date | null; erreurEnvoi?: string | null; echeanceReponse?: Date | null },
  maintenant = new Date(),
): { libelle: string; classe: string } | null {
  if (d.statut === "BROUILLON") {
    if (d.envoiEnCoursLe) return { libelle: "Envoi en cours", classe: "badge-attente" };
    if (d.erreurEnvoi) return { libelle: "Envoi en échec", classe: "badge-alerte" };
    if (d.envoiProgrammeLe) return { libelle: `Programmée le ${formatDateHeureCourte(d.envoiProgrammeLe)}`, classe: "badge-accent" };
  }
  if ((d.statut === "ENVOYEE" || d.statut === "RELANCEE") && d.echeanceReponse && d.echeanceReponse.getTime() < maintenant.getTime()) {
    return { libelle: "Sans réponse (refus implicite)", classe: "badge-alerte" };
  }
  return null;
}

/* ───────────── Relance et saisine de la CADA ───────────── */

/** Extrait la liste des pièces d'un courrier (lignes « - … »). */
export function piecesDuCourrier(corps: string): string {
  return corps
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .join("\n");
}

function signature() {
  const signataire = site.directeurPublication || `L'association ${site.asso.nom}`;
  return `${signataire}
Pour l'association ${site.asso.nom}${site.asso.rna ? ` (RNA ${site.asso.rna})` : ""}
${site.nom} — ${site.url}${site.asso.email ? `\n${site.asso.email}` : ""}`;
}

export function courrierRelance(d: { envoyeeLe: Date | null; objet: string; corps: string; echeanceReponse: Date | null }, maintenant = new Date()): string {
  const depasse = d.echeanceReponse && d.echeanceReponse.getTime() < maintenant.getTime();
  return `Madame, Monsieur le Maire,

Par courriel du ${d.envoyeeLe ? formatJourParis(d.envoyeeLe) : "…"}, l'association ${site.asso.nom} vous a adressé une demande de communication de documents administratifs (objet : « ${d.objet} »). Sauf erreur de notre part, nous n'avons pas encore reçu de réponse.

${
  depasse
    ? "Le silence gardé pendant plus d'un mois sur une demande de communication vaut décision implicite de refus (article R.311-13 du CRPA), que nous serions alors fondés à soumettre à la Commission d'accès aux documents administratifs (CADA). Nous préférerions naturellement obtenir ces documents directement auprès de vos services."
    : "Nous vous remercions par avance de l'attention que vous y porterez."
} Si leur préparation demande du temps, une transmission échelonnée nous convient tout à fait : il vous suffit de nous l'indiquer en réponse à ce message.

Pour rappel, les documents demandés sont les suivants :

${piecesDuCourrier(d.corps)}

Je vous prie d'agréer, Madame, Monsieur le Maire, l'expression de mes salutations distinguées.

${signature()}`;
}

export function courrierSaisineCada(
  d: { envoyeeLe: Date | null; objet: string; corps: string; statut: string; reponseLe: Date | null; destinataire: string },
  commune: { nom: string; mairieAdresse: string | null },
): string {
  const refus =
    d.statut === "REFUS_EXPRES" && d.reponseLe
      ? `La commune a refusé de communiquer ces documents par une décision du ${formatJourParis(d.reponseLe)}.`
      : "Cette demande est restée sans réponse pendant plus d'un mois, ce qui vaut décision implicite de refus (article R.311-13 du CRPA).";
  return `Objet : demande d'avis — refus de communication de documents administratifs par la commune de ${commune.nom}

Madame, Monsieur,

Par courriel du ${d.envoyeeLe ? formatJourParis(d.envoyeeLe) : "…"}, adressé à la mairie de ${commune.nom}${commune.mairieAdresse ? ` (${commune.mairieAdresse})` : ""} à l'adresse ${d.destinataire}, l'association ${site.asso.nom}${site.asso.rna ? ` (RNA ${site.asso.rna})` : ""} a sollicité, sur le fondement des articles L.300-1 et L.311-1 et suivants du code des relations entre le public et l'administration, la communication des documents suivants :

${piecesDuCourrier(d.corps)}

${refus}

En application de l'article L.342-1 du même code, nous sollicitons l'avis de la Commission sur le caractère communicable de ces documents.

Pièces jointes : copie de la demande initiale${d.statut === "REFUS_EXPRES" ? " et de la décision de refus" : ""}.

${signature()}`;
}

import { db } from "./db";

/** Libellés exacts des agrégats OFGL utilisés sur la fiche commune. */
export const A = {
  depensesTotales: "Dépenses totales hors remb",
  recettesTotales: "Recettes totales hors emprunts",
  recettesFonct: "Recettes de fonctionnement",
  depensesFonct: "Dépenses de fonctionnement",
  epargneBrute: "Epargne brute",
  epargneNette: "Epargne nette",
  encoursDette: "Encours de dette",
  annuiteDette: "Annuité de la dette",
  depensesEquipement: "Dépenses d'équipement",
  depensesInvest: "Dépenses d'investissement hors remb",
  personnel: "Frais de personnel",
  achats: "Achats et charges externes",
  intervention: "Dépenses d'intervention",
  chargesFinancieres: "Charges financières",
  autresDepFonct: "Autres dépenses de fonctionnement",
  impotsLocaux: "Impôts locaux",
  dgf: "Dotation globale de fonctionnement",
  subventionsRecues: "Autres dotations et subventions",
  fiscaliteReversee: "Fiscalité reversée",
} as const;

export type Valeur = { montant: number; parHabitant: number | null };
export type Exercice = Map<string, Valeur>;

export type FinancesCommune = {
  exercices: number[]; // croissant
  parExercice: Map<number, Exercice>;
};

/** Agrégats du budget principal d'une commune, indexés par exercice puis par agrégat. */
export async function financesCommune(code: string): Promise<FinancesCommune> {
  const lignes = await db.agregatFinancier.findMany({
    where: { communeCode: code, typeBudget: "Budget principal" },
    select: { exercice: true, agregat: true, montant: true, parHabitant: true },
  });
  const parExercice = new Map<number, Exercice>();
  for (const l of lignes) {
    if (!parExercice.has(l.exercice)) parExercice.set(l.exercice, new Map());
    parExercice.get(l.exercice)!.set(l.agregat, { montant: l.montant, parHabitant: l.parHabitant });
  }
  return { exercices: [...parExercice.keys()].sort((a, b) => a - b), parExercice };
}

export type References = Map<number, Map<string, { mediane: number; moyenne: number; n: number }>>;

/** Médianes nationales par habitant pour une strate, tous exercices. */
export async function referencesStrate(strate: number | null): Promise<References> {
  const res: References = new Map();
  if (strate === null) return res;
  const lignes = await db.referenceStrate.findMany({ where: { strate } });
  for (const l of lignes) {
    if (!res.has(l.exercice)) res.set(l.exercice, new Map());
    res.get(l.exercice)!.set(l.agregat, { mediane: l.medianeParHabitant, moyenne: l.moyenneParHabitant, n: l.nbCommunes });
  }
  return res;
}

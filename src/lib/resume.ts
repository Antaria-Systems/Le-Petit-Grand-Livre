/**
 * Résumé du budget en langage courant. Uniquement des faits chiffrés et des comparaisons à la
 * médiane : aucun jugement sur la gestion de la commune.
 */
import { A, type Exercice } from "./finances";
import { formatEntier, formatEurosCompact, formatPourcentage } from "./format";

/** « 746 € par habitant » : en prose, plus lisible que l'abréviation « €/hab. ». */
const parHab = (n: number) => `${formatEntier(n)}\u00a0€ par habitant`;
import { libelleStrate } from "./strates";

type Ref = Map<string, { mediane: number }> | undefined;

function comparaison(valeur: number | null | undefined, mediane: number | undefined): string | null {
  if (valeur === null || valeur === undefined || !mediane) return null;
  const ecart = (valeur - mediane) / Math.abs(mediane);
  if (Math.abs(ecart) < 0.05) return "un niveau proche de la médiane";
  return `${formatPourcentage(Math.abs(ecart))} ${ecart > 0 ? "de plus" : "de moins"} que la médiane`;
}

export function resumeBudget(nom: string, annee: number, ex: Exercice, ref: Ref, strate: number | null): string[] {
  const v = (a: string) => ex.get(a);
  const phrases: string[] = [];

  const dep = v(A.depensesTotales);
  if (dep) {
    const c = comparaison(dep.parHabitant, ref?.get(A.depensesTotales)?.mediane);
    phrases.push(
      `En ${annee}, ${nom} a dépensé ${formatEurosCompact(dep.montant)}${dep.parHabitant ? `, soit ${parHab(dep.parHabitant)}` : ""}${
        c ? ` — ${c} des communes de ${libelleStrate(strate)}` : ""
      }.`,
    );
  }

  const eb = v(A.epargneBrute);
  const rf = v(A.recettesFonct);
  if (eb && rf && rf.montant > 0) {
    phrases.push(
      eb.montant >= 0
        ? `Ses recettes de fonctionnement dépassent ses dépenses courantes de ${formatEurosCompact(eb.montant)} : cette épargne brute représente ${formatPourcentage(eb.montant / rf.montant)} de ses recettes de fonctionnement.`
        : `Ses dépenses courantes dépassent ses recettes de fonctionnement de ${formatEurosCompact(-eb.montant)}.`,
    );
  }

  const equip = v(A.depensesEquipement);
  if (equip && equip.montant > 0) phrases.push(`Elle a consacré ${formatEurosCompact(equip.montant)} à ses dépenses d'équipement (travaux, bâtiments, voirie, matériel).`);

  const dette = v(A.encoursDette);
  if (dette) {
    const c = comparaison(dette.parHabitant, ref?.get(A.encoursDette)?.mediane);
    const annees = eb && eb.montant > 0 ? dette.montant / eb.montant : null;
    phrases.push(
      `La dette de son budget principal s'élève à ${formatEurosCompact(dette.montant)} au 31 décembre${dette.parHabitant ? ` (${parHab(dette.parHabitant)}${c ? `, ${c}` : ""})` : ""}${
        annees !== null ? ` ; il faudrait ${annees.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} année${annees >= 2 ? "s" : ""} d'épargne brute pour la rembourser entièrement` : ""
      }.`,
    );
  }
  return phrases;
}

/** Capacité de désendettement (encours de dette / épargne brute), en années. */
export function capaciteDesendettement(ex: Exercice): number | null {
  const eb = ex.get(A.epargneBrute)?.montant;
  const dette = ex.get(A.encoursDette)?.montant;
  return eb && eb > 0 && dette !== undefined ? dette / eb : null;
}

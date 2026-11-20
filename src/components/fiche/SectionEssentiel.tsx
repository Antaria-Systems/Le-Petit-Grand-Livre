import { A, type FinancesCommune, type References } from "@/lib/finances";
import { formatEuros, formatEurosCompact, formatParHabitant, formatPourcentage } from "@/lib/format";
import { capaciteDesendettement, resumeBudget } from "@/lib/resume";
import { libelleStrate } from "@/lib/strates";
import { EnTeteSection } from "./EnTeteSection";

type Props = {
  nom: string;
  strate: number | null;
  annee: number;
  finances: FinancesCommune;
  refs: References;
  travaux: { facture: number; nbChantiers: number; anneeMin: number | null; anneeMax: number | null };
};

/** Mini-courbe de tendance (statique) : la série en gris, l'année affichée en couleur. */
function Sparkline({ valeurs, indexCourant }: { valeurs: (number | null)[]; indexCourant: number }) {
  const pts = valeurs.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return null;
  const L = 112;
  const H = 34;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => 4 + (i * (L - 8)) / (valeurs.length - 1);
  const y = (v: number) => (max === min ? H / 2 : 4 + (H - 8) * (1 - (v - min) / (max - min)));
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const c = pts.find((p) => p.i === indexCourant);
  return (
    <svg className="sparkline" width={L} height={H} viewBox={`0 0 ${L} ${H}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--ink-2)" strokeOpacity={0.45} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {c && <circle cx={x(c.i)} cy={y(c.v)} r={3.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />}
    </svg>
  );
}

/** Comparaison visuelle à la médiane : barre de la commune, repère de la médiane. */
function Comparateur({ valeur, mediane, strate }: { valeur: number; mediane: number; strate: number | null }) {
  const max = Math.max(valeur, mediane) * 1.15 || 1;
  const ecart = (valeur - mediane) / Math.abs(mediane || 1);
  const proche = Math.abs(ecart) < 0.05;
  return (
    <div className="comparateur">
      <div className="comparateur-piste" aria-hidden>
        <div className="comparateur-barre" style={{ width: `${(Math.max(0, valeur) / max) * 100}%` }} />
        <div className="comparateur-mediane" style={{ left: `${(mediane / max) * 100}%` }} />
      </div>
      <p>
        <strong>{proche ? "Proche de la médiane" : `${formatPourcentage(Math.abs(ecart))} ${ecart > 0 ? "au-dessus" : "en dessous"}`}</strong>{" "}
        <span className="discret">
          · médiane {formatParHabitant(mediane)} ({libelleStrate(strate)})
        </span>
      </p>
    </div>
  );
}

export function SectionEssentiel({ nom, strate, annee, finances, refs, travaux }: Props) {
  const ex = finances.parExercice.get(annee);
  const ref = refs.get(annee);
  if (!ex) return null;
  const idx = finances.exercices.indexOf(annee);
  const serie = (a: string) => finances.exercices.map((y) => finances.parExercice.get(y)?.get(a)?.montant ?? null);
  const capacite = capaciteDesendettement(ex);
  const phrases = resumeBudget(nom, annee, ex, ref, strate);

  const tuiles = [
    { agregat: A.depensesTotales, libelle: "Dépenses totales", aide: "fonctionnement et investissement, hors remboursement de la dette" },
    { agregat: A.depensesEquipement, libelle: "Investissement", aide: "dépenses d'équipement : travaux, bâtiments, voirie, matériel" },
    { agregat: A.epargneBrute, libelle: "Épargne brute", aide: "ce qui reste des recettes courantes après les dépenses courantes" },
    {
      agregat: A.encoursDette,
      libelle: "Dette au 31 décembre",
      aide: capacite !== null ? `${capacite.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} années d'épargne brute pour la rembourser` : "capital restant dû",
    },
  ];

  return (
    <section id="essentiel" className="bloc" aria-labelledby="titre-essentiel">
      <EnTeteSection id="titre-essentiel" surtitre={`Exercice ${annee}`} titre="L'essentiel" />
      <div className="essentiel-grille">
        <div className="resume">
          {phrases.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {travaux.facture > 0 && (
            <p>
              Les documents obtenus auprès de la mairie détaillent <strong>{formatEuros(travaux.facture)}</strong> de factures de travaux,
              réparties sur {travaux.nbChantiers} chantiers
              {travaux.anneeMin && travaux.anneeMax ? ` entre ${travaux.anneeMin} et ${travaux.anneeMax}` : ""}.{" "}
              <a href="#travaux">Voir les chantiers</a>
            </p>
          )}
        </div>
        <div className="tuiles tuiles-essentiel">
          {tuiles.map((t) => {
            const val = ex.get(t.agregat);
            const med = ref?.get(t.agregat)?.mediane;
            return (
              <div className="carte tuile" key={t.agregat}>
                <div className="tuile-haut">
                  <div>
                    <p className="tuile-libelle">{t.libelle}</p>
                    <p className="tuile-valeur">{val ? formatEurosCompact(val.montant) : "—"}</p>
                    {val?.parHabitant !== null && val?.parHabitant !== undefined && <p className="tuile-sous chiffres">{formatParHabitant(val.parHabitant)}</p>}
                  </div>
                  <Sparkline valeurs={serie(t.agregat)} indexCourant={idx} />
                </div>
                <p className="tuile-aide">{t.aide}</p>
                {val?.parHabitant !== null && val?.parHabitant !== undefined && med !== undefined && (
                  <Comparateur valeur={val.parHabitant} mediane={med} strate={strate} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

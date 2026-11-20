import Link from "next/link";
import { BarreSegmentee, type Part } from "@/components/graphiques/BarreSegmentee";
import { GraphiqueColonnes } from "@/components/graphiques/GraphiqueColonnes";
import { GraphiqueLignes } from "@/components/graphiques/GraphiqueLignes";
import { A, type FinancesCommune, type References } from "@/lib/finances";
import { formatEntier, formatEuros, formatEurosCompact, formatParHabitant, formatPourcentage } from "@/lib/format";
import { libelleStrate } from "@/lib/strates";

type Props = {
  slug: string;
  nom: string;
  strate: number | null;
  annee: number;
  finances: FinancesCommune;
  refs: References;
};

const COMPOSITION: { agregat: string; libelle: string; slot: number }[] = [
  { agregat: A.personnel, libelle: "Frais de personnel", slot: 1 },
  { agregat: A.achats, libelle: "Achats et charges externes", slot: 2 },
  { agregat: A.intervention, libelle: "Subventions et participations", slot: 3 },
  { agregat: A.chargesFinancieres, libelle: "Intérêts de la dette", slot: 4 },
  { agregat: A.autresDepFonct, libelle: "Autres dépenses", slot: 5 },
];

const COMPARAISONS: { agregat: string; libelle: string }[] = [
  { agregat: A.depensesFonct, libelle: "Dépenses de fonctionnement" },
  { agregat: A.personnel, libelle: "dont frais de personnel" },
  { agregat: A.depensesEquipement, libelle: "Dépenses d'équipement" },
  { agregat: A.impotsLocaux, libelle: "Impôts locaux" },
  { agregat: A.dgf, libelle: "Dotation globale de fonctionnement (DGF)" },
  { agregat: A.encoursDette, libelle: "Encours de dette" },
  { agregat: A.epargneBrute, libelle: "Épargne brute" },
];

function Comparaison({ valeur, mediane, strate }: { valeur: number | null | undefined; mediane: number | undefined; strate: number | null }) {
  if (valeur === null || valeur === undefined || mediane === undefined || mediane === 0) return null;
  const ecart = (valeur - mediane) / Math.abs(mediane);
  const proche = Math.abs(ecart) < 0.05;
  return (
    <p className="tuile-comparaison">
      <span className="fleche" aria-hidden>
        {proche ? "≈" : ecart > 0 ? "▲" : "▼"}
      </span>{" "}
      {proche ? "Proche de" : `${formatPourcentage(Math.abs(ecart))} ${ecart > 0 ? "au-dessus de" : "en dessous de"}`} la médiane des communes de{" "}
      {libelleStrate(strate)} ({formatParHabitant(mediane)})
    </p>
  );
}

export function SectionBudget({ slug, nom, strate, annee, finances, refs }: Props) {
  const ex = finances.parExercice.get(annee);
  const ref = refs.get(annee);
  if (!ex) {
    return (
      <div className="vide">
        <strong>Pas de comptes publiés pour cette commune.</strong>
      </div>
    );
  }
  const v = (a: string) => ex.get(a);
  const annees = finances.exercices;
  const etiquettes = annees.map(String);
  const serie = (a: string, parHab = false) =>
    annees.map((y) => {
      const val = finances.parExercice.get(y)?.get(a);
      return val ? (parHab ? val.parHabitant : val.montant) : null;
    });
  const idxAnnee = annees.indexOf(annee);

  const tuiles = [
    { agregat: A.depensesTotales, libelle: "Dépenses totales", aide: "hors remboursement d'emprunts" },
    { agregat: A.recettesTotales, libelle: "Recettes totales", aide: "hors emprunts" },
    { agregat: A.encoursDette, libelle: "Dette au 31 décembre", aide: "encours restant à rembourser" },
    { agregat: A.epargneBrute, libelle: "Épargne brute", aide: "excédent de fonctionnement, disponible pour investir" },
  ];

  const parts: Part[] = COMPOSITION.map((c) => ({
    libelle: c.libelle,
    valeur: v(c.agregat)?.montant ?? 0,
    couleur: `var(--series-${c.slot})`,
    encre: `var(--on-series-${c.slot})`,
  }));
  const totalFonct = v(A.depensesFonct)?.montant ?? 0;

  const recettesF = serie(A.recettesFonct);
  const depensesF = serie(A.depensesFonct);
  const equipement = serie(A.depensesEquipement);
  const detteHab = serie(A.encoursDette, true);
  const medianeDette = annees.map((y) => refs.get(y)?.get(A.encoursDette)?.mediane ?? null);

  return (
    <>
      <div className="bloc-titre">
        <h2 id="titre-budget">Budget {annee}</h2>
        <nav className="selecteur-annee" aria-label="Choisir l'exercice">
          {annees.map((y) => (
            <Link key={y} href={`/communes/${slug}?annee=${y}#budget`} scroll={false} aria-current={y === annee ? "page" : undefined}>
              {y}
            </Link>
          ))}
        </nav>
      </div>

      <div className="tuiles">
        {tuiles.map((t) => {
          const val = v(t.agregat);
          return (
            <div className="carte" key={t.agregat}>
              <p className="tuile-libelle">{t.libelle}</p>
              <p className="tuile-valeur">{val ? formatEurosCompact(val.montant) : "—"}</p>
              <p className="tuile-sous">
                {val?.parHabitant !== null && val?.parHabitant !== undefined ? `${formatParHabitant(val.parHabitant)} · ` : ""}
                {t.aide}
              </p>
              <Comparaison valeur={val?.parHabitant} mediane={ref?.get(t.agregat)?.mediane} strate={strate} />
            </div>
          );
        })}
      </div>

      <div className="graphiques">
        <div className="carte graphique">
          <h3>Fonctionnement : recettes et dépenses</h3>
          <p className="sous-titre">Budget principal, {annees[0]}–{annees[annees.length - 1]}, en euros</p>
          <GraphiqueLignes
            etiquettes={etiquettes}
            format="euros"
            description={`Recettes et dépenses de fonctionnement de ${nom}, de ${annees[0]} à ${annees[annees.length - 1]}.`}
            series={[
              { id: "rec", libelle: "Recettes de fonctionnement", couleur: "var(--series-1)", valeurs: recettesF },
              { id: "dep", libelle: "Dépenses de fonctionnement", couleur: "var(--series-2)", valeurs: depensesF },
            ]}
          />
          <TableauSeries
            legende="Fonctionnement, en euros"
            etiquettes={etiquettes}
            colonnes={[
              { libelle: "Recettes", valeurs: recettesF },
              { libelle: "Dépenses", valeurs: depensesF },
            ]}
          />
        </div>

        <div className="carte graphique">
          <h3>À quoi servent les dépenses de fonctionnement</h3>
          <p className="sous-titre">
            {annee} · {formatEuros(totalFonct)} au total
          </p>
          <BarreSegmentee parts={parts} description={`Répartition des ${formatEuros(totalFonct)} de dépenses de fonctionnement en ${annee}`} />
          <details className="donnees">
            <summary>Voir les données</summary>
            <div className="tableau-defilant">
              <table>
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th className="nombre">Montant</th>
                    <th className="nombre">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.libelle}>
                      <td>{p.libelle}</td>
                      <td className="nombre">{formatEuros(p.valeur)}</td>
                      <td className="nombre">{totalFonct ? formatPourcentage(p.valeur / totalFonct) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <div className="carte graphique">
          <h3>Investissement : dépenses d&apos;équipement</h3>
          <p className="sous-titre">Travaux, achats de matériel, bâtiments, voirie… en euros</p>
          <GraphiqueColonnes
            etiquettes={etiquettes}
            valeurs={equipement}
            libelle="Dépenses d'équipement"
            couleur="var(--series-1)"
            format="euros"
            indexEtiquete={idxAnnee}
            description={`Dépenses d'équipement de ${nom} par année, de ${annees[0]} à ${annees[annees.length - 1]}.`}
          />
          <TableauSeries legende="Dépenses d'équipement, en euros" etiquettes={etiquettes} colonnes={[{ libelle: "Dépenses d'équipement", valeurs: equipement }]} />
        </div>

        <div className="carte graphique">
          <h3>Dette par habitant</h3>
          <p className="sous-titre">Comparée à la médiane nationale des communes de {libelleStrate(strate)}</p>
          <GraphiqueLignes
            etiquettes={etiquettes}
            format="eurosHab"
            description={`Encours de dette par habitant de ${nom} comparé à la médiane des communes de même taille.`}
            series={[
              { id: "commune", libelle: nom, couleur: "var(--series-1)", valeurs: detteHab },
              { id: "mediane", libelle: "Médiane de la strate", couleur: "var(--series-2)", valeurs: medianeDette },
            ]}
          />
          <TableauSeries
            legende="Encours de dette, en euros par habitant"
            etiquettes={etiquettes}
            format="eurosHab"
            colonnes={[
              { libelle: nom, valeurs: detteHab },
              { libelle: "Médiane de la strate", valeurs: medianeDette },
            ]}
          />
        </div>
      </div>

      <div className="carte" style={{ marginTop: 12 }}>
        <h3>Comparaison avec les communes de même taille</h3>
        <p className="sous-titre discret petit">
          {annee}, en euros par habitant. Médiane nationale des communes de {libelleStrate(strate)}
          {ref?.get(A.depensesFonct) ? ` (${formatEntier(ref.get(A.depensesFonct)!.n)} communes)` : ""}.
        </p>
        <div className="tableau-defilant">
          <table>
            <thead>
              <tr>
                <th>Indicateur</th>
                <th className="nombre">{nom}</th>
                <th className="nombre">Médiane</th>
                <th className="nombre">Écart</th>
              </tr>
            </thead>
            <tbody>
              {COMPARAISONS.map((c) => {
                const val = v(c.agregat)?.parHabitant;
                const med = ref?.get(c.agregat)?.mediane;
                const ecart = val !== null && val !== undefined && med ? (val - med) / Math.abs(med) : null;
                return (
                  <tr key={c.agregat}>
                    <td>{c.libelle}</td>
                    <td className="nombre">{val !== null && val !== undefined ? formatParHabitant(val) : "—"}</td>
                    <td className="nombre">{med !== undefined ? formatParHabitant(med) : "—"}</td>
                    <td className="nombre">{ecart === null ? "—" : `${ecart > 0 ? "+" : ecart < 0 ? "−" : ""}${formatPourcentage(Math.abs(ecart))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="source">
        Source : OFGL, comptes du budget principal (balances comptables DGFiP), exercices {annees[0]} à {annees[annees.length - 1]}. Licence
        Ouverte 2.0. <Link href="/methodologie#definitions">Définitions des indicateurs</Link>.
      </p>
    </>
  );
}

function TableauSeries({
  legende,
  etiquettes,
  colonnes,
  format = "euros",
}: {
  legende: string;
  etiquettes: string[];
  colonnes: { libelle: string; valeurs: (number | null)[] }[];
  format?: "euros" | "eurosHab";
}) {
  const f = (n: number | null) => (n === null ? "—" : format === "eurosHab" ? formatParHabitant(n) : formatEuros(n));
  return (
    <details className="donnees">
      <summary>Voir les données</summary>
      <div className="tableau-defilant">
        <table>
          <caption>{legende}</caption>
          <thead>
            <tr>
              <th>Année</th>
              {colonnes.map((c) => (
                <th key={c.libelle} className="nombre">
                  {c.libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etiquettes.map((e, i) => (
              <tr key={e}>
                <td className="chiffres">{e}</td>
                {colonnes.map((c) => (
                  <td key={c.libelle} className="nombre">
                    {f(c.valeurs[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

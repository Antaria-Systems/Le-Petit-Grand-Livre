import Link from "next/link";
import { BarreSegmentee, type Part } from "@/components/graphiques/BarreSegmentee";
import { GraphiqueColonnes } from "@/components/graphiques/GraphiqueColonnes";
import { GraphiqueLignes } from "@/components/graphiques/GraphiqueLignes";
import { A, type Exercice, type FinancesCommune, type References } from "@/lib/finances";
import { formatEuros, formatEurosCompact, formatParHabitant, formatPourcentage } from "@/lib/format";
import { libelleStrate } from "@/lib/strates";
import { EnTeteSection } from "./EnTeteSection";

type Props = {
  slug: string;
  nom: string;
  strate: number | null;
  annee: number;
  finances: FinancesCommune;
  refs: References;
};

const DEPENSES: { agregat: string; libelle: string }[] = [
  { agregat: A.personnel, libelle: "Personnel" },
  { agregat: A.achats, libelle: "Achats et charges externes" },
  { agregat: A.intervention, libelle: "Subventions et participations versées" },
  { agregat: A.chargesFinancieres, libelle: "Intérêts de la dette" },
  { agregat: A.autresDepFonct, libelle: "Autres dépenses" },
];

const RECETTES: { agregat: string; libelle: string }[] = [
  { agregat: "Impôts locaux", libelle: "Impôts locaux" },
  { agregat: "Concours de l'Etat", libelle: "Dotations de l'État" },
  { agregat: "Autres impôts et taxes", libelle: "Autres impôts et taxes" },
  { agregat: "Subventions reçues et participations", libelle: "Subventions reçues" },
  { agregat: "Ventes de biens et services", libelle: "Ventes et services" },
  { agregat: "Autres recettes de fonctionnement", libelle: "Autres recettes" },
];

/** Parts d'un total, avec une part « non ventilée » si la somme des postes n'atteint pas le total. */
function parts(ex: Exercice, postes: { agregat: string; libelle: string }[], total: number): Part[] {
  const liste: Part[] = postes.map((p, i) => ({
    libelle: p.libelle,
    valeur: Math.max(0, ex.get(p.agregat)?.montant ?? 0),
    couleur: `var(--series-${i + 1})`,
    encre: `var(--on-series-${i + 1})`,
  }));
  const reste = total - liste.reduce((s, p) => s + p.valeur, 0);
  if (reste > total * 0.005) liste.push({ libelle: "Non ventilé", valeur: reste, couleur: "var(--line-strong)", encre: "var(--ink)" });
  return liste;
}

const COMPARAISONS: { agregat: string; libelle: string }[] = [
  { agregat: A.depensesFonct, libelle: "Dépenses de fonctionnement" },
  { agregat: A.personnel, libelle: "dont personnel" },
  { agregat: A.depensesEquipement, libelle: "Dépenses d'équipement" },
  { agregat: A.impotsLocaux, libelle: "Impôts locaux" },
  { agregat: A.dgf, libelle: "Dotation globale de fonctionnement" },
  { agregat: A.encoursDette, libelle: "Encours de dette" },
  { agregat: A.epargneBrute, libelle: "Épargne brute" },
];

function Composition({ titre, sousTitre, liste, total, description }: { titre: string; sousTitre: string; liste: Part[]; total: number; description: string }) {
  return (
    <div className="carte graphique">
      <h3>{titre}</h3>
      <p className="sous-titre">{sousTitre}</p>
      <BarreSegmentee parts={liste} description={description} />
      <table className="table-composition">
        <caption className="sr-only">{titre}</caption>
        <tbody>
          {liste.filter((p) => p.valeur > 0).map((p) => (
            <tr key={p.libelle}>
              <td>
                <span className="cle-carre" style={{ background: p.couleur }} aria-hidden /> {p.libelle}
              </td>
              <td className="nombre">{formatEuros(p.valeur)}</td>
              <td className="nombre discret">{total ? formatPourcentage(p.valeur / total) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionBudget({ slug, nom, strate, annee, finances, refs }: Props) {
  const ex = finances.parExercice.get(annee);
  const ref = refs.get(annee);
  if (!ex) return null;
  const v = (a: string) => ex.get(a);
  const annees = finances.exercices;
  const etiquettes = annees.map(String);
  const serie = (a: string, parHab = false) =>
    annees.map((y) => {
      const val = finances.parExercice.get(y)?.get(a);
      return val ? (parHab ? val.parHabitant : val.montant) : null;
    });

  const totalDep = v(A.depensesFonct)?.montant ?? 0;
  const totalRec = v(A.recettesFonct)?.montant ?? 0;
  const recettesF = serie(A.recettesFonct);
  const depensesF = serie(A.depensesFonct);
  const equipement = serie(A.depensesEquipement);
  const detteHab = serie(A.encoursDette, true);
  const medianeDette = annees.map((y) => refs.get(y)?.get(A.encoursDette)?.mediane ?? null);
  const plage = `${annees[0]}–${annees[annees.length - 1]}`;

  const lignesComparaison = COMPARAISONS.map((c) => {
    const val = v(c.agregat)?.parHabitant ?? null;
    const med = ref?.get(c.agregat)?.mediane ?? null;
    return { ...c, val, med, ecart: val !== null && med ? (val - med) / Math.abs(med) : null };
  });
  const ecartMax = Math.max(0.25, ...lignesComparaison.map((l) => Math.abs(l.ecart ?? 0)));

  return (
    <section id="budget" className="bloc" aria-labelledby="titre-budget">
      <EnTeteSection
        id="titre-budget"
        surtitre="Comptes de la commune"
        titre={`Budget ${annee}`}
        description="Budget principal, d'après les comptes publiés par l'OFGL. Le fonctionnement couvre les dépenses courantes ; l'investissement, les travaux et équipements."
      >
        <nav className="selecteur-annee" aria-label="Choisir l'exercice">
          {annees.map((y) => (
            <Link key={y} href={`/communes/${slug}?annee=${y}#budget`} scroll={false} aria-current={y === annee ? "page" : undefined}>
              {y}
            </Link>
          ))}
        </nav>
      </EnTeteSection>

      <div className="graphiques">
        <Composition
          titre="D'où vient l'argent"
          sousTitre={`Recettes de fonctionnement ${annee} · ${formatEurosCompact(totalRec)}`}
          liste={parts(ex, RECETTES, totalRec)}
          total={totalRec}
          description={`Répartition des ${formatEuros(totalRec)} de recettes de fonctionnement en ${annee}`}
        />
        <Composition
          titre="Où va l'argent"
          sousTitre={`Dépenses de fonctionnement ${annee} · ${formatEurosCompact(totalDep)}`}
          liste={parts(ex, DEPENSES, totalDep)}
          total={totalDep}
          description={`Répartition des ${formatEuros(totalDep)} de dépenses de fonctionnement en ${annee}`}
        />

        <div className="carte graphique">
          <h3>Recettes et dépenses courantes</h3>
          <p className="sous-titre">Fonctionnement, {plage}. L&apos;écart entre les deux courbes est l&apos;épargne brute.</p>
          <GraphiqueLignes
            etiquettes={etiquettes}
            format="euros"
            description={`Recettes et dépenses de fonctionnement de ${nom}, ${plage}.`}
            series={[
              { id: "rec", libelle: "Recettes", couleur: "var(--series-1)", valeurs: recettesF },
              { id: "dep", libelle: "Dépenses", couleur: "var(--series-2)", valeurs: depensesF },
            ]}
          />
          <TableauSeries legende="Fonctionnement, en euros" etiquettes={etiquettes} colonnes={[{ libelle: "Recettes", valeurs: recettesF }, { libelle: "Dépenses", valeurs: depensesF }]} />
        </div>

        <div className="carte graphique">
          <h3>Investissement</h3>
          <p className="sous-titre">Dépenses d&apos;équipement par an, {plage}</p>
          <GraphiqueColonnes
            etiquettes={etiquettes}
            valeurs={equipement}
            libelle="Dépenses d'équipement"
            couleur="var(--series-1)"
            format="euros"
            indexEtiquete={annees.indexOf(annee)}
            description={`Dépenses d'équipement de ${nom}, ${plage}.`}
          />
          <TableauSeries legende="Dépenses d'équipement, en euros" etiquettes={etiquettes} colonnes={[{ libelle: "Dépenses d'équipement", valeurs: equipement }]} />
        </div>

        <div className="carte graphique graphique-large">
          <h3>Dette par habitant</h3>
          <p className="sous-titre">Comparée à la médiane nationale des communes de {libelleStrate(strate)}</p>
          <GraphiqueLignes
            etiquettes={etiquettes}
            format="eurosHab"
            hauteur={220}
            description={`Encours de dette par habitant de ${nom} et médiane des communes de même taille, ${plage}.`}
            series={[
              { id: "commune", libelle: nom, couleur: "var(--series-1)", valeurs: detteHab },
              { id: "mediane", libelle: "Médiane des communes de même taille", couleur: "var(--series-2)", valeurs: medianeDette },
            ]}
          />
          <TableauSeries
            legende="Encours de dette, en euros par habitant"
            etiquettes={etiquettes}
            format="eurosHab"
            colonnes={[
              { libelle: nom, valeurs: detteHab },
              { libelle: "Médiane", valeurs: medianeDette },
            ]}
          />
        </div>
      </div>

      <div className="carte" style={{ marginTop: 16 }}>
        <h3>Comparaison avec les communes de même taille</h3>
        <p className="sous-titre">
          {annee}, en euros par habitant · médiane nationale des communes de {libelleStrate(strate)}
          {ref?.get(A.depensesFonct) ? ` (${ref.get(A.depensesFonct)!.n.toLocaleString("fr-FR")} communes)` : ""}
        </p>
        <div className="tableau-defilant">
          <table className="table-comparaison">
            <thead>
              <tr>
                <th>Indicateur</th>
                <th className="nombre">{nom}</th>
                <th className="nombre">Médiane</th>
                <th className="col-ecart">Écart à la médiane</th>
              </tr>
            </thead>
            <tbody>
              {lignesComparaison.map((l) => (
                <tr key={l.agregat}>
                  <td>{l.libelle}</td>
                  <td className="nombre">{l.val !== null ? formatParHabitant(l.val) : "—"}</td>
                  <td className="nombre discret">{l.med !== null ? formatParHabitant(l.med) : "—"}</td>
                  <td className="col-ecart">
                    {l.ecart === null ? (
                      "—"
                    ) : (
                      <div className="ecart">
                        <div className="ecart-piste" aria-hidden>
                          <div
                            className={`ecart-barre ${l.ecart >= 0 ? "ecart-plus" : "ecart-moins"}`}
                            style={{ width: `${(Math.min(Math.abs(l.ecart), ecartMax) / ecartMax) * 50}%` }}
                          />
                        </div>
                        <span className="chiffres">
                          {l.ecart > 0 ? "+" : l.ecart < 0 ? "−" : ""}
                          {formatPourcentage(Math.abs(l.ecart))}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="source">
        Source : OFGL, comptes du budget principal (balances comptables DGFiP), exercices {plage}, Licence Ouverte 2.0 ·{" "}
        <Link href="/methodologie#definitions">Définitions</Link> · <a href={`/communes/${slug}/donnees.csv`}>Télécharger les données (CSV)</a>
      </p>
    </section>
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

import { formatEntier, formatEuros, formatEurosCentimes } from "@/lib/format";
import { EnTeteSection } from "./EnTeteSection";

/**
 * Taux maximaux de référence des indemnités de fonction, en % de l'indice brut terminal (IB 1027)
 * de la fonction publique : CGCT, art. L.2123-23 (maire) et L.2123-24 (adjoints), dans leur
 * rédaction issue de la loi n° 2025-1249 du 22 décembre 2025. Montants : annexe DGCL, valeur du
 * point d'indice au 1er janvier 2026 (IB 1027 = 4 110,52 € bruts mensuels).
 * La population de référence est la population TOTALE (et non municipale).
 */
const IB_1027_MENSUEL = 4110.52;
const BAREME: { min: number; max: number; libelle: string; maire: number; adjoint: number }[] = [
  { min: 0, max: 499, libelle: "moins de 500 habitants", maire: 28.1, adjoint: 10.89 },
  { min: 500, max: 999, libelle: "500 à 999 habitants", maire: 44.3, adjoint: 11.77 },
  { min: 1000, max: 3499, libelle: "1 000 à 3 499 habitants", maire: 55.7, adjoint: 21.38 },
  { min: 3500, max: 9999, libelle: "3 500 à 9 999 habitants", maire: 58.3, adjoint: 23.32 },
  { min: 10000, max: 19999, libelle: "10 000 à 19 999 habitants", maire: 67.6, adjoint: 28.6 },
  { min: 20000, max: 49999, libelle: "20 000 à 49 999 habitants", maire: 90, adjoint: 33 },
  { min: 50000, max: 99999, libelle: "50 000 à 99 999 habitants", maire: 110, adjoint: 44 },
  { min: 100000, max: 200000, libelle: "100 000 à 200 000 habitants", maire: 145, adjoint: 66 },
  { min: 200001, max: Number.MAX_SAFE_INTEGER, libelle: "plus de 200 000 habitants", maire: 145, adjoint: 72.5 },
];
const mensuel = (taux: number) => formatEurosCentimes((IB_1027_MENSUEL * taux) / 100);

type Indemnite = { annee: number; fonction: string; ordre: number; montantBrutAnnuel: { toString(): string } };
type Frais = { annee: number; fonction: string; nature: string; montant: { toString(): string } };

export function SectionElus({
  population,
  populationTotale,
  indemnites,
  frais = [],
}: {
  population: number | null;
  populationTotale?: number | null;
  indemnites: Indemnite[];
  frais?: Frais[];
}) {
  // Barème légal : population totale (à défaut, population municipale).
  const reference = populationTotale ?? population;
  const tranche = reference !== null && reference !== undefined ? BAREME.find((b) => reference >= b.min && reference <= b.max) : undefined;
  const annee = indemnites.length ? Math.max(...indemnites.map((i) => i.annee)) : null;
  const lignes = indemnites.filter((i) => i.annee === annee).sort((a, b) => a.ordre - b.ordre);

  return (
    <section id="elus" className="bloc" aria-labelledby="titre-elus">
      <EnTeteSection
        id="titre-elus"
        surtitre="Conseil municipal"
        titre="Élus et indemnités"
        description="Les indemnités et les frais sont présentés par fonction (maire, adjoints…) plutôt que par nom. Chaque fonction correspond toutefois à une personne identifiable."
      />
      {frais.length > 0 && <TableauFrais frais={frais} />}
      <div className="travaux-grille">
        {lignes.length > 0 ? (
          <div className="carte">
            <h3>Indemnités de fonction {annee}</h3>
            <table>
              <thead>
                <tr>
                  <th>Fonction</th>
                  <th className="nombre">Brut annuel</th>
                  <th className="nombre">Brut mensuel</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{l.fonction}</td>
                    <td className="nombre">{formatEuros(Number(l.montantBrutAnnuel.toString()))}</td>
                    <td className="nombre">{formatEuros(Number(l.montantBrutAnnuel.toString()) / 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="vide">
            <strong>Indemnités pas encore obtenues.</strong>
            <p style={{ margin: "8px 0 0" }}>
              Chaque commune établit tous les ans un état des indemnités perçues par ses élus (art. L.2123-24-1-1 du <abbr title="code général des collectivités territoriales">CGCT</abbr>). Il sera demandé
              à la mairie dans la prochaine demande groupée, puis publié ici par fonction.
            </p>
          </div>
        )}
        {tranche && (
          <div className="carte encadre-methode">
            <h3>Ce que prévoit la loi</h3>
            <p>
              Pour une commune de <strong>{tranche.libelle}</strong>
              {populationTotale ? ` (population totale : ${formatEntier(populationTotale)} habitants)` : ""}, le taux maximal de référence de
              l&apos;indemnité brute mensuelle est de&nbsp;:
            </p>
            <dl className="plafonds">
              <div>
                <dt>Maire</dt>
                <dd>
                  {tranche.maire.toLocaleString("fr-FR")}&nbsp;% <span className="discret petit">soit {mensuel(tranche.maire)} bruts par mois</span>
                </dd>
              </div>
              <div>
                <dt>Adjoint</dt>
                <dd>
                  {tranche.adjoint.toLocaleString("fr-FR")}&nbsp;% <span className="discret petit">soit {mensuel(tranche.adjoint)} bruts par mois</span>
                </dd>
              </div>
            </dl>
            <p className="discret petit">
              En pourcentage de l&apos;indice brut terminal de la fonction publique (IB&nbsp;1027, soit {formatEurosCentimes(IB_1027_MENSUEL)} bruts
              mensuels au 1<sup>er</sup>&nbsp;janvier 2026). Ces taux ne sont pas des plafonds individuels absolus&nbsp;: l&apos;indemnité
              d&apos;un adjoint peut dépasser ce taux dans la limite de l&apos;enveloppe globale du maire et des adjoints, et certaines communes
              peuvent voter des majorations (art. L.2123-22). Le maire peut demander une indemnité inférieure. Sources&nbsp;: Code général des
              collectivités territoriales, art. L.2123-23 et L.2123-24, dans leur rédaction issue de la loi n°&nbsp;2025-1249 du 22&nbsp;décembre
              2025&nbsp;; montants&nbsp;: DGCL.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Frais remboursés aux élus : total par fonction et par nature, pour la dernière année connue. */
function TableauFrais({ frais }: { frais: Frais[] }) {
  const annee = Math.max(...frais.map((f) => f.annee));
  const de = frais.filter((f) => f.annee === annee);
  const natures = [...new Set(de.map((f) => f.nature))].sort();
  const fonctions = [...new Set(de.map((f) => f.fonction))];
  const somme = (fn: (f: Frais) => boolean) => de.filter(fn).reduce((s, f) => s + Number(f.montant.toString()), 0);
  return (
    <div className="carte" style={{ marginBottom: 12 }}>
      <h3>Frais remboursés aux élus en {annee}</h3>
      <div className="tableau-defilant">
        <table>
          <thead>
            <tr>
              <th>Fonction</th>
              {natures.map((n) => (
                <th key={n} className="nombre">
                  {n}
                </th>
              ))}
              <th className="nombre">Total</th>
            </tr>
          </thead>
          <tbody>
            {fonctions.map((fn) => (
              <tr key={fn}>
                <td>{fn}</td>
                {natures.map((n) => {
                  const v = somme((f) => f.fonction === fn && f.nature === n);
                  return (
                    <td key={n} className="nombre">
                      {v ? formatEuros(v) : "—"}
                    </td>
                  );
                })}
                <th className="nombre">{formatEuros(somme((f) => f.fonction === fn))}</th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

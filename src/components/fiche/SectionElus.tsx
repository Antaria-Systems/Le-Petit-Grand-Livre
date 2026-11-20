import { formatEuros } from "@/lib/format";
import { EnTeteSection } from "./EnTeteSection";

/**
 * Plafonds des indemnités de fonction, en % de l'indice brut terminal de la fonction publique
 * (CGCT, art. L.2123-23 pour le maire, L.2123-24 pour les adjoints).
 */
const BAREME: { min: number; max: number; libelle: string; maire: number; adjoint: number }[] = [
  { min: 0, max: 499, libelle: "moins de 500 habitants", maire: 25.5, adjoint: 9.9 },
  { min: 500, max: 999, libelle: "500 à 999 habitants", maire: 40.3, adjoint: 10.7 },
  { min: 1000, max: 3499, libelle: "1 000 à 3 499 habitants", maire: 51.6, adjoint: 19.8 },
  { min: 3500, max: 9999, libelle: "3 500 à 9 999 habitants", maire: 55, adjoint: 22 },
  { min: 10000, max: 19999, libelle: "10 000 à 19 999 habitants", maire: 65, adjoint: 27.5 },
  { min: 20000, max: 49999, libelle: "20 000 à 49 999 habitants", maire: 90, adjoint: 33 },
  { min: 50000, max: 99999, libelle: "50 000 à 99 999 habitants", maire: 110, adjoint: 44 },
];

type Indemnite = { annee: number; fonction: string; ordre: number; montantBrutAnnuel: { toString(): string } };
type Frais = { annee: number; fonction: string; nature: string; montant: { toString(): string } };

export function SectionElus({ population, indemnites, frais = [] }: { population: number | null; indemnites: Indemnite[]; frais?: Frais[] }) {
  const tranche = population !== null ? BAREME.find((b) => population >= b.min && population <= b.max) : undefined;
  const annee = indemnites.length ? Math.max(...indemnites.map((i) => i.annee)) : null;
  const lignes = indemnites.filter((i) => i.annee === annee).sort((a, b) => a.ordre - b.ordre);

  return (
    <section id="elus" className="bloc" aria-labelledby="titre-elus">
      <EnTeteSection
        id="titre-elus"
        surtitre="Conseil municipal"
        titre="Élus et indemnités"
        description="Les indemnités sont publiées par fonction (maire, adjoints…), jamais nominativement."
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
              Chaque commune établit tous les ans un état des indemnités perçues par ses élus (art. L.2123-24-1-1 du CGCT). Il sera demandé
              à la mairie dans la prochaine demande groupée, puis publié ici par fonction.
            </p>
          </div>
        )}
        {tranche && (
          <div className="carte encadre-methode">
            <h3>Ce que prévoit la loi</h3>
            <p>
              Pour une commune de <strong>{tranche.libelle}</strong>, l&apos;indemnité brute mensuelle est plafonnée à :
            </p>
            <dl className="plafonds">
              <div>
                <dt>Maire</dt>
                <dd>{tranche.maire.toLocaleString("fr-FR")} %</dd>
              </div>
              <div>
                <dt>Adjoint</dt>
                <dd>{tranche.adjoint.toLocaleString("fr-FR")} %</dd>
              </div>
            </dl>
            <p className="discret petit">
              de l&apos;indice brut terminal de la fonction publique. Le conseil municipal peut voter un montant inférieur. Sources : Code
              général des collectivités territoriales, art. L.2123-23 et L.2123-24.
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

import Link from "next/link";
import { FilAriane } from "@/components/FilAriane";
import { formatEntier } from "@/lib/format";
import { centreChemin as centre } from "@/lib/geometrie";
import { libelleStrate } from "@/lib/strates";

type Props = {
  commune: {
    code: string;
    nom: string;
    slug: string;
    population: number | null;
    epciNom: string | null;
    strate: number | null;
    codesPostaux: string[];
    mairieAdresse: string | null;
    mairieTelephone: string | null;
    mairieEmail: string | null;
    mairieSite: string | null;
    presentation: string | null;
  };
  departement: { code: string; nom: string };
  region: { code: string; nom: string };
  carte: { viewBox: string; chemin: string } | null;
  nbDocuments: number;
  exercices?: number[];
};

export function EnteteCommune({ commune, departement, region, carte, nbDocuments, exercices = [] }: Props) {
  const site = commune.mairieSite?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="fiche-bandeau">
      <div className="conteneur fiche-bandeau-grille">
        <div className="fiche-identite">
          <FilAriane
            elements={[
              { libelle: "Territoires", href: "/regions" },
              { libelle: region.nom, href: `/regions/${region.code}` },
              { libelle: departement.nom, href: `/departements/${departement.code}` },
              { libelle: commune.nom },
            ]}
          />
          <p className="surtitre">
            Commune · {departement.nom} ({departement.code})
          </p>
          <h1>{commune.nom}</h1>
          {commune.presentation && (
            <div className="fiche-presentation">
              {commune.presentation
                .split(/\n\s*\n/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i}>{p.trim()}</p>
                ))}
            </div>
          )}
          <dl className="faits">
            {commune.population !== null && (
              <div>
                <dt>Population</dt>
                <dd className="chiffres">{formatEntier(commune.population)} hab.</dd>
              </div>
            )}
            <div>
              <dt>Taille</dt>
              <dd>{libelleStrate(commune.strate)}</dd>
            </div>
            {commune.epciNom && (
              <div>
                <dt>Intercommunalité</dt>
                <dd>{commune.epciNom}</dd>
              </div>
            )}
            <div>
              <dt>Codes</dt>
              <dd className="chiffres">
                INSEE {commune.code}
                {commune.codesPostaux[0] ? ` · ${commune.codesPostaux.join(", ")}` : ""}
              </dd>
            </div>
          </dl>
          <p className="fiche-documents-compteur">
            <span className="point-vert" aria-hidden /> {nbDocuments} document{nbDocuments > 1 ? "s" : ""} publié{nbDocuments > 1 ? "s" : ""} ·
            {exercices.length ? `comptes OFGL ${exercices[0]} à ${exercices[exercices.length - 1]}` : "pas de comptes OFGL publiés"}
          </p>
        </div>

        <aside className="fiche-cote">
          {carte && (
            <figure className="carte-situation">
              <svg viewBox={carte.viewBox} role="img" aria-label={`Situation de ${commune.nom} dans le département ${departement.nom}`}>
                {/* Fond partagé et mis en cache par le navigateur (toutes les communes du département) */}
                <use href={`/cartes/${departement.code}.svg#fond`} className="carte-fond" />
                <path d={carte.chemin} className="carte-active" />
                {(() => {
                  // Repère : la commune est souvent minuscule à l'échelle du département
                  const [x, y] = centre(carte.chemin);
                  return (
                    <>
                      <circle cx={x} cy={y} r={34} className="carte-halo" />
                      <circle cx={x} cy={y} r={11} className="carte-repere" />
                    </>
                  );
                })()}
              </svg>
              <figcaption className="discret petit">
                Situation dans le département · <Link prefetch={false} href={`/departements/${departement.code}`}>toutes les communes</Link>
              </figcaption>
            </figure>
          )}
          {(commune.mairieAdresse || commune.mairieTelephone || commune.mairieSite) && (
            <div className="carte-mairie">
              <p className="surtitre">Mairie</p>
              {commune.mairieAdresse && <p>{commune.mairieAdresse}</p>}
              <p className="carte-mairie-liens">
                {commune.mairieTelephone && <a href={`tel:${commune.mairieTelephone.replace(/\s/g, "")}`}>{commune.mairieTelephone}</a>}
                {commune.mairieSite && (
                  <a href={commune.mairieSite} target="_blank" rel="noopener noreferrer">
                    {site}
                    <span className="sr-only"> (site de la mairie, nouvel onglet)</span>
                  </a>
                )}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

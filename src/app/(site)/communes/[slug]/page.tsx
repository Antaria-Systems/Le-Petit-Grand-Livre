import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { DonneesStructurees } from "@/components/DonneesStructurees";
import { BibliothequeDocuments } from "@/components/fiche/BibliothequeDocuments";
import { EnteteCommune } from "@/components/fiche/EnteteCommune";
import { EnTeteSection } from "@/components/fiche/EnTeteSection";
import { NavFiche } from "@/components/fiche/NavFiche";
import { SectionBudget } from "@/components/fiche/SectionBudget";
import { SectionElus } from "@/components/fiche/SectionElus";
import { SectionEssentiel } from "@/components/fiche/SectionEssentiel";
import { SectionTravaux } from "@/components/fiche/SectionTravaux";
import { site } from "@/lib/config";
import { db } from "@/lib/db";
import { A, financesCommune, referencesStrate } from "@/lib/finances";
import { formatDate, formatDateCourte, formatEntier } from "@/lib/format";
import { deCommune } from "@/lib/lieux";
import { descriptionCommune, metadonnees, urlAbsolue } from "@/lib/seo";
import { STATUT_DEMANDE } from "@/lib/statuts";
import { travauxCommune } from "@/lib/travaux";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const chargerCommune = cache((slug: string) =>
  db.commune.findUnique({ where: { slug }, include: { departement: { include: { region: true } } } }),
);
// Partagés entre les métadonnées et la page (une seule requête de chaque par affichage).
const chargerFinances = cache((code: string) => financesCommune(code));
const compterDocuments = cache((code: string) => db.document.count({ where: { communeCode: code, statut: "PUBLIE" } }));

/**
 * Adresse approchante (« /communes/lavalette », « /communes/11199 ») : redirection vers la fiche si
 * elle désigne une seule commune ; sinon, page introuvable.
 */
async function redirigerSiPossible(slug: string): Promise<void> {
  const candidates = /^\d[\dab]\d{3}$/.test(slug)
    ? await db.commune.findMany({ where: { code: slug.toUpperCase() }, select: { slug: true }, take: 1 })
    : (await db.commune.findMany({ where: { slug: { startsWith: `${slug}-` } }, select: { slug: true }, take: 5 })).filter((c) =>
        /^\d[\dAB]\d{3}$/.test(c.slug.slice(slug.length + 1)),
      );
  if (candidates.length === 1) permanentRedirect(`/communes/${candidates[0].slug}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await chargerCommune((await params).slug);
  if (!c) return { title: "Commune introuvable", robots: { index: false } };
  const [finances, nbDocuments] = await Promise.all([chargerFinances(c.code), compterDocuments(c.code)]);
  const annee = finances.exercices[finances.exercices.length - 1];
  const dernier = annee !== undefined ? finances.parExercice.get(annee) : undefined;
  const codePostal = c.codesPostaux[0];
  return metadonnees({
    // « Lavalette (11290) » : le code postal est souvent tapé avec le nom, et départage les homonymes.
    titre: `${c.nom} (${codePostal ?? c.departementCode}) : budget, dette et travaux`,
    titrePartage: `${c.nom} (${c.departement.nom}) : budget, dette et travaux de la commune`,
    description: descriptionCommune({
      nom: c.nom,
      departement: c.departement.nom,
      codePostal,
      population: c.population,
      annee,
      depenses: dernier?.get(A.depensesTotales)?.montant,
      detteParHabitant: dernier?.get(A.encoursDette)?.parHabitant,
      nbDocuments,
    }),
    chemin: `/communes/${c.slug}`,
    imageDuDossier: true,
  });
}

const SECTIONS = [
  { id: "essentiel", libelle: "L'essentiel" },
  { id: "budget", libelle: "Budget" },
  { id: "travaux", libelle: "Travaux et marchés" },
  { id: "elus", libelle: "Élus" },
  { id: "documents", libelle: "Documents" },
  { id: "origine", libelle: "Sources" },
];

export default async function PageCommune({ params, searchParams }: Props) {
  const { slug } = await params;
  const commune = await chargerCommune(slug);
  if (!commune) {
    await redirigerSiPossible(slug);
    notFound();
  }

  const [finances, refs, travaux, indemnites, frais, demandes, lots, importe, voisines] = await Promise.all([
    chargerFinances(commune.code),
    referencesStrate(commune.strate),
    travauxCommune(commune.code),
    db.indemniteFonction.findMany({ where: { communeCode: commune.code }, orderBy: [{ annee: "desc" }, { ordre: "asc" }] }),
    db.fraisFonction.findMany({ where: { communeCode: commune.code } }),
    db.demande.findMany({
      where: { communeCode: commune.code, statut: { not: "BROUILLON" } },
      orderBy: { annee: "desc" },
      include: { _count: { select: { documents: { where: { statut: "PUBLIE" } } } } },
    }),
    db.document.groupBy({
      by: ["lot"],
      where: { communeCode: commune.code, statut: "PUBLIE" },
      _count: true,
      _min: { recuLe: true },
      _max: { publieLe: true },
    }),
    db.etat.findUnique({ where: { cle: `import:finances:${commune.departementCode}` } }),
    commune.epciNom
      ? db.commune.findMany({
          where: { epciNom: commune.epciNom, code: { not: commune.code }, departement: { actif: true } },
          orderBy: { nomRecherche: "asc" },
          select: { nom: true, slug: true, population: true },
        })
      : Promise.resolve([]),
  ]);

  const anneeDemandee = Number((await searchParams).annee);
  const annee = finances.exercices.includes(anneeDemandee) ? anneeDemandee : finances.exercices[finances.exercices.length - 1];
  const carte = commune.departement.carteViewBox && commune.cheminCarte ? { viewBox: commune.departement.carteViewBox, chemin: commune.cheminCarte } : null;
  const dernierePublication = lots.map((l) => l._max.publieLe).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];

  // Pour les moteurs : la page, la commune qu'elle décrit et le jeu de données téléchargeable
  // (repris par Google Dataset Search).
  const url = urlAbsolue(`/communes/${commune.slug}`);
  const importeLe = importe ? new Date(importe.valeur) : undefined;
  const modifieLe = [commune.majLe, dernierePublication, importeLe].filter((d): d is Date => d instanceof Date && !isNaN(d.getTime())).sort((a, b) => b.getTime() - a.getTime())[0];
  const [premier, dernier] = [finances.exercices[0], finances.exercices[finances.exercices.length - 1]];
  const pourMoteurs = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${commune.nom} : budget, dette et travaux de la commune`,
        inLanguage: "fr-FR",
        isPartOf: { "@type": "WebSite", "@id": `${urlAbsolue("/")}#site`, name: site.nom, url: urlAbsolue("/") },
        about: { "@id": `${url}#commune` },
        ...(modifieLe ? { dateModified: modifieLe.toISOString() } : {}),
      },
      {
        "@type": "City",
        "@id": `${url}#commune`,
        name: commune.nom,
        identifier: { "@type": "PropertyValue", propertyID: "Code officiel géographique (Insee)", value: commune.code },
        address: {
          "@type": "PostalAddress",
          addressLocality: commune.nom,
          ...(commune.codesPostaux[0] ? { postalCode: commune.codesPostaux[0] } : {}),
          addressRegion: commune.departement.nom,
          addressCountry: "FR",
        },
        containedInPlace: { "@type": "AdministrativeArea", name: commune.departement.nom, url: urlAbsolue(`/departements/${commune.departementCode}`) },
      },
      ...(premier !== undefined
        ? [
            {
              "@type": "Dataset",
              "@id": `${url}#comptes`,
              name: `Comptes de la commune ${deCommune(commune.nom)} (${commune.departement.nom}), ${premier}-${dernier}`,
              description: `Agrégats financiers de la commune ${deCommune(commune.nom)} (code Insee ${commune.code}, ${commune.departement.nom}), exercices ${premier} à ${dernier} : recettes et dépenses de fonctionnement et d'investissement, épargne brute et nette, encours et annuité de la dette, impôts locaux, dotations et subventions, en euros et en euros par habitant, pour le budget principal et les budgets annexes. Source : Observatoire des finances et de la gestion publique locales (OFGL), d'après les comptes de la DGFiP.`,
              url,
              keywords: [commune.nom, commune.departement.nom, "finances locales", "budget communal", "dette", "impôts locaux", "comptes des communes"],
              license: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
              isAccessibleForFree: true,
              inLanguage: "fr",
              creator: { "@type": "Organization", name: "Observatoire des finances et de la gestion publique locales (OFGL)", url: "https://data.ofgl.fr/" },
              publisher: { "@type": "NGO", name: site.asso.nom || site.nom, ...(site.asso.site ? { url: site.asso.site } : {}) },
              isBasedOn: "https://data.ofgl.fr/explore/dataset/ofgl-base-communes/",
              spatialCoverage: { "@type": "Place", name: `${commune.nom}, ${commune.departement.nom}, France` },
              temporalCoverage: `${premier}/${dernier}`,
              distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: urlAbsolue(`/communes/${commune.slug}/donnees.csv`) }],
              ...(importeLe && !isNaN(importeLe.getTime()) ? { dateModified: importeLe.toISOString() } : {}),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <DonneesStructurees donnees={pourMoteurs} />
      <EnteteCommune
        commune={commune}
        departement={commune.departement}
        region={commune.departement.region}
        carte={carte}
        nbDocuments={travaux.documents.length}
        exercices={finances.exercices}
      />
      <NavFiche sections={SECTIONS} />

      <div className="conteneur">
        {annee !== undefined ? (
          <>
            <SectionEssentiel
              nom={commune.nom}
              strate={commune.strate}
              annee={annee}
              finances={finances}
              refs={refs}
              travaux={{ ...travaux.totaux, nbChantiers: travaux.chantiers.length }}
            />
            <SectionBudget slug={commune.slug} nom={commune.nom} strate={commune.strate} annee={annee} finances={finances} refs={refs} />
          </>
        ) : (
          <section id="essentiel" className="bloc">
            <div className="vide">
              <strong>Pas de comptes publiés pour cette commune.</strong>
            </div>
            <span id="budget" />
          </section>
        )}

        <SectionTravaux chantiers={travaux.chantiers} totaux={travaux.totaux} />
        <SectionElus population={commune.population} populationTotale={commune.populationTotale} indemnites={indemnites} frais={frais} />

        <section id="documents" className="bloc" aria-labelledby="titre-documents">
          <EnTeteSection
            id="titre-documents"
            surtitre="Pièces justificatives"
            titre="Tous les documents"
            description="Documents obtenus auprès de la mairie au titre du droit d'accès aux documents administratifs. Les mentions protégées (coordonnées personnelles, données bancaires, signatures) sont masquées."
          />
          {travaux.documents.length > 0 ? (
            <BibliothequeDocuments documents={travaux.documents} />
          ) : (
            <div className="vide">
              <strong>Aucun document publié pour l&apos;instant.</strong>
            </div>
          )}
        </section>

        <section id="origine" className="bloc" aria-labelledby="titre-origine">
          <EnTeteSection id="titre-origine" surtitre="Transparence" titre="Sources et méthode" />
          <div className="sources-grille">
            <div className="carte">
              <h3>Comptes de la commune</h3>
              <p>
                Agrégats de l&apos;Observatoire des finances et de la gestion publique locales (OFGL), calculés à partir des comptes tenus
                par la Direction générale des finances publiques (DGFiP), et médianes nationales des communes de même taille. Licence
                Ouverte 2.0{importe ? `, données importées le ${formatDate(new Date(importe.valeur))}` : ""}.
              </p>
              <p className="petit">
                <a href={`/communes/${commune.slug}/donnees.csv`}>Télécharger les données (CSV)</a> ·{" "}
                <Link prefetch={false} href="/methodologie#definitions">Définitions</Link>
              </p>
            </div>
            {demandes.length > 0 && (
              <div className="carte">
                <h3>Demandes adressées à la mairie</h3>
                {demandes.map((d) => {
                  const etapes = [
                    d.envoyeeLe && { date: d.envoyeeLe, texte: "Demande envoyée" },
                    d.relanceeLe && { date: d.relanceeLe, texte: "Relance" },
                    d.reponseLe && { date: d.reponseLe, texte: "Réponse de la mairie" },
                    d.cadaSaisieLe && { date: d.cadaSaisieLe, texte: "Saisine de la CADA" },
                    d.avisCadaLe && { date: d.avisCadaLe, texte: `Avis de la CADA${d.avisCada ? ` : ${d.avisCada}` : ""}` },
                    d.clotureLe && { date: d.clotureLe, texte: "Demande close" },
                  ]
                    .filter((e): e is { date: Date; texte: string } => Boolean(e))
                    .sort((a, b) => a.date.getTime() - b.date.getTime());
                  return (
                    <div key={d.id} className="demande-publique">
                      <p>
                        <strong>Demande {d.annee}</strong> <span className={`badge ${STATUT_DEMANDE[d.statut].classe}`}>{STATUT_DEMANDE[d.statut].libelle}</span>
                      </p>
                      <ol className="chronologie">
                        {etapes.map((e) => (
                          <li key={e.texte}>
                            <time dateTime={e.date.toISOString()}>{formatDateCourte(e.date)}</time>
                            <span>{e.texte}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="petit discret">
                        {d._count.documents} document{d._count.documents > 1 ? "s" : ""} publié{d._count.documents > 1 ? "s" : ""} à la suite de cette demande
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="carte">
              <h3>Documents de la mairie</h3>
              {lots.length > 0 ? (
                <ul className="liste-simple">
                  {lots.map((l) => (
                    <li key={l.lot ?? "sans-lot"}>
                      {l._count} document{l._count > 1 ? "s" : ""}
                      {l.lot ? ` · ${l.lot}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun document reçu pour l&apos;instant.</p>
              )}
              <p className="petit">
                Obtenus au titre de l&apos;article L.311-1 du <abbr title="code des relations entre le public et l'administration">CRPA</abbr>. Dates, entreprises et montants relevés sur les pièces
                {dernierePublication ? ` ; dernière publication le ${formatDate(dernierePublication)}` : ""}.
              </p>
            </div>
            <div className="carte">
              <h3>Une erreur&nbsp;?</h3>
              <p>
                Un montant mal relevé, une mention qui aurait dû être masquée&nbsp;: écrivez-nous, nous corrigeons ou retirons le document au plus
                vite.
              </p>
              {site.asso.email && (
                <p className="petit">
                  <a href={`mailto:${site.asso.email}?subject=${encodeURIComponent(`Fiche ${commune.nom} (${commune.code})`)}`}>{site.asso.email}</a>
                </p>
              )}
            </div>
          </div>
        </section>

        {voisines.length > 0 && (
          <section id="alentours" className="bloc" aria-labelledby="titre-alentours">
            <EnTeteSection
              id="titre-alentours"
              surtitre="Alentours"
              titre="Dans la même intercommunalité"
              description={`${commune.epciNom} : ${formatEntier(voisines.length)} autre${voisines.length > 1 ? "s" : ""} commune${voisines.length > 1 ? "s" : ""}, avec leur budget, leur dette et leurs documents.`}
            />
            {voisines.length > 24 ? (
              <details className="donnees">
                <summary>Voir les {formatEntier(voisines.length)} communes</summary>
                <ListeVoisines communes={voisines} />
              </details>
            ) : (
              <ListeVoisines communes={voisines} />
            )}
          </section>
        )}
      </div>
    </>
  );
}

function ListeVoisines({ communes }: { communes: { nom: string; slug: string; population: number | null }[] }) {
  return (
    <ul className="liste-communes">
      {communes.map((c) => (
        <li key={c.slug}>
          <Link prefetch={false} href={`/communes/${c.slug}`}>
            <span>{c.nom}</span>
            {c.population !== null && <span className="discret chiffres">{formatEntier(c.population)} hab.</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

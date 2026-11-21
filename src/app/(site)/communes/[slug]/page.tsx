import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
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
import { financesCommune, referencesStrate } from "@/lib/finances";
import { formatDate, formatDateCourte } from "@/lib/format";
import { deCommune } from "@/lib/lieux";
import { STATUT_DEMANDE } from "@/lib/statuts";
import { travauxCommune } from "@/lib/travaux";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const chargerCommune = cache((slug: string) =>
  db.commune.findUnique({ where: { slug }, include: { departement: { include: { region: true } } } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await chargerCommune((await params).slug);
  if (!c) return { title: "Commune introuvable" };
  const description = `Budget, dette, travaux et documents de la commune ${deCommune(c.nom)} (${c.departement.nom}) : comptes publics et pièces obtenues auprès de la mairie, rendus lisibles.`;
  return {
    title: `${c.nom} (${c.departementCode}) : budget, travaux, documents`,
    description,
    alternates: { canonical: `/communes/${c.slug}` },
    openGraph: { title: `${c.nom} · ${site.nom}`, description, type: "website", locale: "fr_FR", siteName: site.nom, url: `/communes/${c.slug}` },
    twitter: { card: "summary_large_image" },
  };
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
  if (!commune) notFound();

  const [finances, refs, travaux, indemnites, frais, demandes, lots, importe] = await Promise.all([
    financesCommune(commune.code),
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
  ]);

  const anneeDemandee = Number((await searchParams).annee);
  const annee = finances.exercices.includes(anneeDemandee) ? anneeDemandee : finances.exercices[finances.exercices.length - 1];
  const carte = commune.departement.carteViewBox && commune.cheminCarte ? { viewBox: commune.departement.carteViewBox, chemin: commune.cheminCarte } : null;
  const dernierePublication = lots.map((l) => l._max.publieLe).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
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
      </div>
    </>
  );
}

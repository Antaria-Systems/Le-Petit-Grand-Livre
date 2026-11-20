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
import { formatDate } from "@/lib/format";
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
  const description = `Budget, dette, travaux et documents de la commune de ${c.nom} (${c.departement.nom}) : comptes publics et pièces obtenues auprès de la mairie, rendus lisibles.`;
  return {
    title: `${c.nom} (${c.departementCode}) : budget, travaux, documents`,
    description,
    alternates: { canonical: `/communes/${c.slug}` },
    openGraph: { title: `${c.nom} · ${site.nom}`, description, type: "website", locale: "fr_FR" },
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

  const [finances, refs, travaux, indemnites, lots] = await Promise.all([
    financesCommune(commune.code),
    referencesStrate(commune.strate),
    travauxCommune(commune.code),
    db.indemniteFonction.findMany({ where: { communeCode: commune.code }, orderBy: [{ annee: "desc" }, { ordre: "asc" }] }),
    db.document.groupBy({
      by: ["lot"],
      where: { communeCode: commune.code, statut: "PUBLIE" },
      _count: true,
      _min: { recuLe: true },
      _max: { publieLe: true },
    }),
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
        <SectionElus population={commune.population} indemnites={indemnites} />

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
                par la DGFiP, et médianes nationales des communes de même taille.
              </p>
              <p className="petit">
                <a href={`/communes/${commune.slug}/donnees.csv`}>Télécharger les données (CSV)</a> ·{" "}
                <Link href="/methodologie#definitions">Définitions</Link>
              </p>
            </div>
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
                Obtenus au titre de l&apos;article L.311-1 du CRPA. Dates, entreprises et montants relevés sur les pièces
                {dernierePublication ? ` ; dernière publication le ${formatDate(dernierePublication)}` : ""}.
              </p>
            </div>
            <div className="carte">
              <h3>Une erreur ?</h3>
              <p>
                Un montant mal relevé, une mention qui aurait dû être masquée : écrivez-nous, nous corrigeons ou retirons le document au plus
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

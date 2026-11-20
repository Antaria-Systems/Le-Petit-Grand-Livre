import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { FilAriane } from "@/components/FilAriane";
import { SectionBudget } from "@/components/fiche/SectionBudget";
import { SectionDemandes, SectionDocuments, SectionElus, SectionTravaux } from "@/components/fiche/SectionsDocumentaires";
import { db } from "@/lib/db";
import { financesCommune, referencesStrate } from "@/lib/finances";
import { formatEntier } from "@/lib/format";

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
  return {
    title: `${c.nom} (${c.departementCode}) : budget, élus, travaux`,
    description: `Finances de la commune de ${c.nom} (${c.departement.nom}) : budget, dette, indemnités des élus, travaux et documents obtenus auprès de la mairie.`,
  };
}

export default async function PageCommune({ params, searchParams }: Props) {
  const { slug } = await params;
  const commune = await chargerCommune(slug);
  if (!commune) notFound();

  const [finances, refs, indemnites, frais, operations, documents, demandes] = await Promise.all([
    financesCommune(commune.code),
    referencesStrate(commune.strate),
    db.indemniteFonction.findMany({ where: { communeCode: commune.code }, orderBy: [{ annee: "desc" }, { ordre: "asc" }] }),
    db.fraisFonction.findMany({ where: { communeCode: commune.code } }),
    db.operation.findMany({ where: { communeCode: commune.code }, orderBy: [{ annee: "desc" }, { date: "desc" }], take: 100 }),
    db.document.findMany({
      where: { communeCode: commune.code, statut: "PUBLIE" },
      orderBy: { publieLe: "desc" },
      select: { id: true, titre: true, categorie: true, annee: true, nbPages: true, publieLe: true },
    }),
    db.demande.findMany({
      where: { communeCode: commune.code, statut: { not: "BROUILLON" } },
      orderBy: { annee: "desc" },
      include: { _count: { select: { documents: { where: { statut: "PUBLIE" } } } } },
    }),
  ]);

  const anneeDemandee = Number((await searchParams).annee);
  const annee = finances.exercices.includes(anneeDemandee) ? anneeDemandee : finances.exercices[finances.exercices.length - 1];

  return (
    <>
      <FilAriane
        elements={[
          { libelle: commune.departement.region.nom, href: `/regions/${commune.departement.region.code}` },
          { libelle: commune.departement.nom, href: `/departements/${commune.departementCode}` },
          { libelle: commune.nom },
        ]}
      />
      <div className="conteneur fiche-entete">
        <p className="surtitre">Commune</p>
        <h1>{commune.nom}</h1>
        <ul className="fiche-meta">
          {commune.population !== null && (
            <li>
              <strong className="chiffres">{formatEntier(commune.population)}</strong> habitants
            </li>
          )}
          <li>
            {commune.departement.nom} ({commune.departementCode})
          </li>
          {commune.epciNom && <li>{commune.epciNom}</li>}
          <li className="discret">INSEE {commune.code}</li>
        </ul>
      </div>

      <nav className="nav-fiche" aria-label="Sections de la fiche">
        <div className="conteneur">
          <ul>
            <li><a href="#budget">Budget</a></li>
            <li><a href="#elus">Élus &amp; indemnités</a></li>
            <li><a href="#travaux">Travaux &amp; marchés</a></li>
            <li><a href="#documents">Documents</a></li>
            <li><a href="#demandes">Suivi des demandes</a></li>
          </ul>
        </div>
      </nav>

      <div className="conteneur">
        <section id="budget" className="bloc" aria-labelledby="titre-budget">
          {annee === undefined ? (
            <>
              <h2 id="titre-budget">Budget</h2>
              <div className="vide">
                <strong>Pas de comptes disponibles pour cette commune.</strong>
              </div>
            </>
          ) : (
            <SectionBudget slug={commune.slug} nom={commune.nom} strate={commune.strate} annee={annee} finances={finances} refs={refs} />
          )}
        </section>

        <section id="elus" className="bloc" aria-labelledby="titre-elus">
          <h2 id="titre-elus">Élus &amp; indemnités</h2>
          <SectionElus indemnites={indemnites} frais={frais} />
        </section>

        <section id="travaux" className="bloc" aria-labelledby="titre-travaux">
          <h2 id="titre-travaux">Travaux &amp; marchés</h2>
          <SectionTravaux operations={operations} />
        </section>

        <section id="documents" className="bloc" aria-labelledby="titre-documents">
          <h2 id="titre-documents">Documents publiés</h2>
          <SectionDocuments documents={documents} />
        </section>

        <section id="demandes" className="bloc" aria-labelledby="titre-demandes">
          <h2 id="titre-demandes">Suivi des demandes</h2>
          <SectionDemandes demandes={demandes} emailMairie={commune.mairieEmail} />
        </section>
      </div>
    </>
  );
}

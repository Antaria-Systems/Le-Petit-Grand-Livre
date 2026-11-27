import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EnTetePage } from "@/components/EnTetePage";
import { FiltreCommunes } from "@/components/FiltreCommunes";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";
import { deDepartement } from "@/lib/lieux";
import { metadonnees } from "@/lib/seo";

type Props = { params: Promise<{ code: string }> };

// cache() : une seule requête pour les métadonnées et la page.
const charger = cache(async (code: string) => {
  return db.departement.findUnique({
    where: { code },
    include: {
      region: true,
      communes: { orderBy: { nomRecherche: "asc" }, select: { nom: true, slug: true, population: true, nomRecherche: true } },
    },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await charger((await params).code);
  if (!d) return { title: "Département introuvable", robots: { index: false } };
  return metadonnees({
    titre: `Communes ${deDepartement(d.nom)} (${d.code}) : budget, dette et documents`,
    description: d.actif
      ? `Budget, dette, impôts locaux, travaux et documents des ${formatEntier(d.communes.length)} communes ${deDepartement(d.nom)} (${d.code}) : comptes publics et pièces obtenues auprès des mairies, commune par commune.`
      : `Les communes ${deDepartement(d.nom)} ne sont pas encore couvertes par la plateforme.`,
    chemin: `/departements/${d.code}`,
    // Département pas encore couvert : page presque vide, non indexée.
    indexer: d.actif,
    imageDuDossier: true,
  });
}

export default async function PageDepartement({ params }: Props) {
  const dep = await charger((await params).code);
  if (!dep) notFound();
  const population = dep.communes.reduce((s, c) => s + (c.population ?? 0), 0);

  return (
    <>
      <EnTetePage
        ariane={[
          { libelle: "Territoires", href: "/regions" },
          { libelle: dep.region.nom, href: `/regions/${dep.region.code}` },
          { libelle: dep.nom },
        ]}
        surtitre={`Département · ${dep.code}`}
        titre={dep.nom}
        chapo={
          dep.actif
            ? `${formatEntier(dep.communes.length)} communes et ${formatEntier(population)} habitants. Choisissez une commune pour consulter son budget, ses travaux et ses documents.`
            : `Les communes ${deDepartement(dep.nom)} ne sont pas encore couvertes par la plateforme.`
        }
        cote={
          dep.carteViewBox ? (
            <svg className="carte-departement" viewBox={dep.carteViewBox} role="img" aria-label={`Carte des communes du département ${dep.nom}`}>
              <use href={`/cartes/${dep.code}.svg#fond`} className="carte-fond" />
            </svg>
          ) : undefined
        }
      />
      <section className="section">
        <div className="conteneur">
          {dep.actif ? (
            <FiltreCommunes communes={dep.communes.map((c) => ({ nom: c.nom, slug: c.slug, population: c.population, cle: c.nomRecherche }))} />
          ) : (
            <div className="vide">
              <strong>En attendant</strong>
              <p>
                La plateforme démarre dans l&apos;Aude et s&apos;étendra département par département. Les comptes de toutes les communes
                sont déjà publiés en open data par l&apos;OFGL&nbsp;:{" "}
                <a href={`https://data.ofgl.fr/explore/dataset/ofgl-base-communes/table/?refine.dep_code=${dep.code}`}>
                  consulter les comptes des communes {deDepartement(dep.nom)} sur data.ofgl.fr
                </a>
                .
              </p>
              <p className="boutons-ligne">
                <Link prefetch={false} href="/departements/11" className="bouton">
                  Voir les communes de l&apos;Aude
                </Link>
                <Link prefetch={false} href="/recherche" className="bouton">
                  Rechercher une commune
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

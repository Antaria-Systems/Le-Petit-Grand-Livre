import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnTetePage } from "@/components/EnTetePage";
import { FiltreCommunes } from "@/components/FiltreCommunes";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";

type Props = { params: Promise<{ code: string }> };

async function charger(code: string) {
  return db.departement.findUnique({
    where: { code },
    include: {
      region: true,
      communes: { orderBy: { nomRecherche: "asc" }, select: { nom: true, slug: true, population: true, nomRecherche: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await charger((await params).code);
  return { title: d ? `Communes du département ${d.nom} (${d.code})` : "Département introuvable" };
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
            : "Ce département n'est pas encore couvert."
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
              <strong>Ce département n&apos;est pas encore couvert.</strong>
              <p>
                La plateforme démarre dans l&apos;Aude et s&apos;étendra progressivement. Les comptes de toutes les communes sont déjà
                publiés en open data par l&apos;OFGL&nbsp;: ils seront intégrés ici au fil de l&apos;extension.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

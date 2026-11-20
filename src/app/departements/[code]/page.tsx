import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilAriane } from "@/components/FilAriane";
import { FiltreCommunes } from "@/components/FiltreCommunes";
import { db } from "@/lib/db";

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

  return (
    <>
      <FilAriane elements={[{ libelle: dep.region.nom, href: `/regions/${dep.region.code}` }, { libelle: dep.nom }]} />
      <section className="section">
        <div className="conteneur">
          <p className="surtitre">Département {dep.code}</p>
          <h1>{dep.nom}</h1>
          {dep.actif ? (
            <FiltreCommunes communes={dep.communes.map((c) => ({ nom: c.nom, slug: c.slug, population: c.population, cle: c.nomRecherche }))} />
          ) : (
            <div className="vide" style={{ marginTop: 24 }}>
              <strong>Ce département n&apos;est pas encore couvert.</strong>
              <p style={{ margin: "8px 0 0" }}>
                La plateforme démarre dans l&apos;Aude et s&apos;étendra progressivement. Les comptes de toutes les
                communes sont déjà publiés en open data par l&apos;OFGL&nbsp;: ils seront intégrés ici au fil de
                l&apos;extension.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

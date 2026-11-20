import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilAriane } from "@/components/FilAriane";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";

type Props = { params: Promise<{ code: string }> };

async function charger(code: string) {
  return db.region.findUnique({
    where: { code },
    include: { departements: { orderBy: { code: "asc" }, include: { _count: { select: { communes: true } } } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await charger((await params).code);
  return { title: r ? `Région ${r.nom}` : "Région introuvable" };
}

export default async function PageRegion({ params }: Props) {
  const region = await charger((await params).code);
  if (!region) notFound();

  return (
    <>
      <FilAriane elements={[{ libelle: region.nom }]} />
      <section className="section">
        <div className="conteneur">
          <p className="surtitre">Région</p>
          <h1>{region.nom}</h1>
          <h2 className="sr-only">Départements</h2>
          <div className="grille" style={{ marginTop: 24 }}>
            {region.departements.map((d) => (
              <Link key={d.code} href={`/departements/${d.code}`} className={`carte carte-region${d.actif ? "" : " carte-inactive"}`}>
                <h3>
                  {d.nom} <span className="discret">({d.code})</span>
                </h3>
                {d.actif ? (
                  <span className="badge badge-accent">{formatEntier(d._count.communes)} communes couvertes</span>
                ) : (
                  <span className="badge">Pas encore couvert</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

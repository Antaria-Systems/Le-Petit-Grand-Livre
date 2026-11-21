import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnTetePage } from "@/components/EnTetePage";
import { IconeFleche } from "@/components/Icones";
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
  const couverts = region.departements.filter((d) => d.actif);
  const communes = couverts.reduce((s, d) => s + d._count.communes, 0);

  return (
    <>
      <EnTetePage
        ariane={[{ libelle: "Territoires", href: "/regions" }, { libelle: region.nom }]}
        surtitre="Région"
        titre={region.nom}
        chapo={
          couverts.length > 0
            ? `${couverts.length} département${couverts.length > 1 ? "s" : ""} couvert${couverts.length > 1 ? "s" : ""} sur ${region.departements.length}, soit ${formatEntier(communes)} communes.`
            : `Aucun des ${region.departements.length} départements de la région n'est encore couvert.`
        }
      />
      <section className="section">
        <div className="conteneur">
          <h2 className="titre-liste">Départements</h2>
          <ul className="tuiles-territoires">
            {region.departements.map((d) => (
              <li key={d.code}>
                <Link href={`/departements/${d.code}`} className={`tuile-territoire${d.actif ? " couvert" : ""}`}>
                  <span className="tuile-territoire-code chiffres">{d.code}</span>
                  <span className="tuile-territoire-nom">{d.nom}</span>
                  {d.actif ? (
                    <span className="badge badge-ok">{formatEntier(d._count.communes)} communes couvertes</span>
                  ) : (
                    <span className="badge">Pas encore couvert</span>
                  )}
                  {d.actif && <IconeFleche className="tuile-fleche" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

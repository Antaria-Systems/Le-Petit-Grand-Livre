import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/EnTetePage";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";
import { metadonnees } from "@/lib/seo";

export const metadata: Metadata = metadonnees({
  titre: "Régions et départements : les finances des communes",
  description: "Régions et départements couverts par la plateforme, et ceux qui le seront prochainement : budget, dette et documents des communes.",
  chemin: "/regions",
});

export default async function Territoires() {
  const regions = await db.region.findMany({
    orderBy: { nom: "asc" },
    include: { departements: { orderBy: { code: "asc" }, include: { _count: { select: { communes: true } } } } },
  });
  const couverts = regions.flatMap((r) => r.departements.filter((d) => d.actif));

  return (
    <>
      <EnTetePage
        ariane={[{ libelle: "Territoires" }]}
        titre="Tous les territoires"
        chapo={
          <>
            {couverts.length} département{couverts.length > 1 ? "s" : ""} couvert{couverts.length > 1 ? "s" : ""} sur{" "}
            {regions.reduce((s, r) => s + r.departements.length, 0)}. La plateforme s&apos;étend département par département&nbsp;: les
            comptes de toutes les communes y seront intégrés au fil de l&apos;extension.
          </>
        }
      />
      <section className="section">
        <div className="conteneur">
          <div className="territoires">
            {regions.map((r) => (
              <section key={r.code} className="territoire" aria-labelledby={`region-${r.code}`}>
                <h2 id={`region-${r.code}`}>
                  <Link prefetch={false} href={`/regions/${r.code}`}>{r.nom}</Link>
                </h2>
                <ul>
                  {r.departements.map((d) => (
                    <li key={d.code}>
                      <Link prefetch={false} href={`/departements/${d.code}`} className={d.actif ? "couvert" : undefined}>
                        <span className="territoire-code chiffres">{d.code}</span>
                        <span className="territoire-nom">{d.nom}</span>
                        {d.actif && <span className="badge badge-ok">{formatEntier(d._count.communes)} communes</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

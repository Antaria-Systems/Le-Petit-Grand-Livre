import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/EnTetePage";
import { RechercheCommune } from "@/components/RechercheCommune";
import { formatEntier } from "@/lib/format";
import { rechercherCommunes } from "@/lib/recherche";

export const metadata: Metadata = { title: "Rechercher une commune", robots: { index: false, follow: true } };

/** Résultats de recherche côté serveur : fonctionne aussi sans JavaScript. */
export default async function Recherche({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const resultats = q.trim().length >= 2 ? await rechercherCommunes(q, 30) : [];
  return (
    <>
      <EnTetePage ariane={[{ libelle: "Recherche" }]} titre={<>Rechercher une commune</>} />
      <section className="section">
        <div className="conteneur">
          <RechercheCommune valeurInitiale={q} />
          {q.trim().length >= 2 && (
            <>
              <p className="discret" role="status">
                {resultats.length === 0
                  ? `Aucune commune ne correspond à « ${q} ». Vérifiez l'orthographe ou essayez le code postal.`
                  : `${resultats.length} commune${resultats.length > 1 ? "s" : ""} pour « ${q} »`}
              </p>
              <ul className="liste-communes">
                {resultats.map((r) => (
                  <li key={r.slug}>
                    <Link prefetch={false} href={`/communes/${r.slug}`}>
                      <span>{r.nom}</span>
                      <span className="discret">
                        {r.departement}
                        {r.population ? ` · ${formatEntier(r.population)} hab.` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="petit">
                La plateforme couvre pour l&apos;instant l&apos;Aude. <Link href="/regions">Voir tous les territoires</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}

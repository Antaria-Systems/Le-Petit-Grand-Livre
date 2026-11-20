import Link from "next/link";
import { RechercheCommune } from "@/components/RechercheCommune";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";

export default async function Accueil() {
  const [regions, nbCommunes, nbDocuments, nbDemandes] = await Promise.all([
    db.region.findMany({
      orderBy: { nom: "asc" },
      include: { departements: { select: { code: true, actif: true, _count: { select: { communes: true } } } } },
    }),
    db.commune.count(),
    db.document.count({ where: { statut: "PUBLIE" } }),
    db.demande.count({ where: { statut: { not: "BROUILLON" } } }),
  ]);

  return (
    <>
      <section className="hero">
        <div className="conteneur">
          <p className="surtitre">Transparence des finances locales</p>
          <h1>Où va l&apos;argent de votre commune&nbsp;?</h1>
          <p className="chapo">
            Budget, dette, indemnités des élus, travaux : nous rassemblons les données publiques et les documents
            obtenus auprès des mairies, et nous les rendons lisibles, sans fouiller dans des tableurs.
          </p>
          <RechercheCommune />
          <p className="discret petit" style={{ marginTop: 16 }}>
            <span className="chiffres">{formatEntier(nbCommunes)}</span> communes couvertes ·{" "}
            <span className="chiffres">{formatEntier(nbDocuments)}</span> documents publiés ·{" "}
            <span className="chiffres">{formatEntier(nbDemandes)}</span> demandes envoyées
          </p>
        </div>
      </section>

      <section className="section" id="explorer" aria-labelledby="titre-explorer">
        <div className="conteneur">
          <h2 id="titre-explorer">Explorer par région</h2>
          <div className="grille">
            {regions.map((r) => {
              const couvertes = r.departements.filter((d) => d.actif);
              const communes = r.departements.reduce((s, d) => s + d._count.communes, 0);
              return (
                <Link key={r.code} href={`/regions/${r.code}`} className={`carte carte-region${couvertes.length ? "" : " carte-inactive"}`}>
                  <h3>{r.nom}</h3>
                  <p>{r.departements.length} départements</p>
                  {couvertes.length > 0 ? (
                    <span className="badge badge-accent">
                      {formatEntier(communes)} communes couvertes
                    </span>
                  ) : (
                    <span className="badge">Bientôt</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="titre-methode">
        <div className="conteneur">
          <h2 id="titre-methode">Comment ça marche</h2>
          <div className="etapes">
            <div className="carte etape">
              <h3>On rassemble l&apos;open data</h3>
              <p>Comptes des communes (OFGL), référentiels officiels : les données déjà publiques, mises en forme et comparées aux communes de même taille.</p>
            </div>
            <div className="carte etape">
              <h3>On demande le reste aux mairies</h3>
              <p>Indemnités, frais, factures de travaux : une demande groupée par an et par commune, au titre du droit d&apos;accès aux documents administratifs (art. L.311-1 du CRPA).</p>
            </div>
            <div className="carte etape">
              <h3>On occulte, puis on publie</h3>
              <p>Coordonnées personnelles, données bancaires, signatures : tout est masqué avant publication. Les élus apparaissent par fonction, jamais par nom.</p>
            </div>
          </div>
          <p style={{ marginTop: 16 }}>
            <Link href="/methodologie">Lire la méthodologie complète</Link>
          </p>
        </div>
      </section>
    </>
  );
}

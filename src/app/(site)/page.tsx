import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, PictoCourrier, PictoDonnees, PictoOccultation } from "@/components/Icones";
import { RechercheCommune } from "@/components/RechercheCommune";
import { site } from "@/lib/config";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";
import { centreChemin } from "@/lib/geometrie";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Accueil() {
  const [regions, nbCommunes, nbDocuments, nbDemandes, nbChantiers, aLaUne, nbAvecDocuments] = await Promise.all([
    db.region.findMany({
      orderBy: { nom: "asc" },
      include: { departements: { select: { code: true, nom: true, actif: true, _count: { select: { communes: true } } } } },
    }),
    db.commune.count({ where: { departement: { actif: true } } }),
    db.document.count({ where: { statut: "PUBLIE" } }),
    db.demande.count({ where: { statut: { not: "BROUILLON" } } }),
    db.operation.count(),
    db.commune.findMany({
      where: { documents: { some: { statut: "PUBLIE" } } },
      orderBy: { documents: { _count: "desc" } },
      take: 3,
      select: {
        nom: true,
        slug: true,
        population: true,
        cheminCarte: true,
        presentation: true,
        departement: { select: { code: true, nom: true, carteViewBox: true } },
        _count: { select: { documents: { where: { statut: "PUBLIE" } }, operations: true, indemnites: true } },
      },
    }),
    db.commune.count({ where: { documents: { some: { statut: "PUBLIE" } } } }),
  ]);
  const accord = (n: number, singulier: string, pluriel: string) => (n > 1 ? pluriel : singulier);
  const departementsActifs = regions.flatMap((r) => r.departements.filter((d) => d.actif));

  return (
    <>
      <section className="hero" aria-labelledby="titre-accueil">
        <div className="conteneur hero-grille">
          <div>
            <p className="surtitre">Transparence des finances locales</p>
            <h1 id="titre-accueil">Où va l&apos;argent de votre commune&nbsp;?</h1>
            <p className="chapo">
              Budget, dette, indemnités des élus, factures de travaux&nbsp;: nous rassemblons les comptes publics et les documents
              obtenus auprès des mairies, et nous les rendons lisibles.
            </p>
            <div id="recherche">
              <RechercheCommune />
            </div>
            {aLaUne[0] && (
              <p className="hero-exemple">
                Par exemple&nbsp;: <Link prefetch={false} href={`/communes/${aLaUne[0].slug}`}>{aLaUne[0].nom}</Link> ({aLaUne[0].departement.nom})
              </p>
            )}
          </div>
          <aside className="hero-chiffres" aria-labelledby="titre-chiffres">
            <h2 id="titre-chiffres" className="surtitre">
              La plateforme en chiffres
            </h2>
            <dl>
              <div>
                <dt>
                  {accord(nbCommunes, "commune couverte", "communes couvertes")}
                  {nbAvecDocuments > 0 && <span className="hero-precision"> dont {formatEntier(nbAvecDocuments)} avec des documents de la mairie</span>}
                </dt>
                <dd className="chiffres">{formatEntier(nbCommunes)}</dd>
              </div>
              <div>
                <dt>{accord(nbDocuments, "document de mairie publié", "documents de mairies publiés")}</dt>
                <dd className="chiffres">{formatEntier(nbDocuments)}</dd>
              </div>
              {nbDemandes > 0 ? (
                <div>
                  <dt>{accord(nbDemandes, "demande adressée aux mairies", "demandes adressées aux mairies")}</dt>
                  <dd className="chiffres">{formatEntier(nbDemandes)}</dd>
                </div>
              ) : (
                <div>
                  <dt>{accord(nbChantiers, "chantier de travaux documenté", "chantiers de travaux documentés")}</dt>
                  <dd className="chiffres">{formatEntier(nbChantiers)}</dd>
                </div>
              )}
            </dl>
            {departementsActifs.length > 0 && (
              <p className="hero-couverture">
                Couverture&nbsp;:{" "}
                {departementsActifs.map((d, i) => (
                  <span key={d.code}>
                    {i > 0 && ", "}
                    <Link prefetch={false} href={`/departements/${d.code}`}>
                      {d.nom} ({d.code})
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </aside>
        </div>
      </section>

      {aLaUne.length > 0 && (
        <section className="section" aria-labelledby="titre-une">
          <div className="conteneur">
            <div className="section-tete">
              <div>
                <h2 id="titre-une">Les fiches les plus complètes</h2>
                <p className="section-description">Communes dont les documents ont déjà été obtenus, vérifiés et publiés.</p>
              </div>
            </div>
            <div className={`cartes-une${aLaUne.length === 1 ? " une-seule" : ""}`}>
              {aLaUne.map((c) => (
                <article key={c.slug} className="carte-une">
                  {c.departement.carteViewBox && c.cheminCarte && (
                    <div className="carte-une-visuel" aria-hidden>
                      <svg viewBox={c.departement.carteViewBox}>
                        <use href={`/cartes/${c.departement.code}.svg#fond`} className="carte-fond" />
                        <path d={c.cheminCarte} className="carte-active" />
                        {(() => {
                          const [x, y] = centreChemin(c.cheminCarte);
                          return (
                            <>
                              <circle cx={x} cy={y} r={34} className="carte-halo" />
                              <circle cx={x} cy={y} r={11} className="carte-repere" />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  )}
                  <div className="carte-une-corps">
                    <p className="surtitre">
                      {c.departement.nom} ({c.departement.code})
                    </p>
                    <h3>
                      <Link prefetch={false} href={`/communes/${c.slug}`} className="lien-etendu">
                        {c.nom}
                      </Link>
                    </h3>
                    <p className="carte-une-texte">
                      {c.presentation?.split(/\n/)[0] ||
                        `Budget et dette depuis 2018, comparaison aux communes de même taille, ${c._count.operations > 0 ? "chantiers reconstitués à partir des factures, " : ""}${c._count.indemnites > 0 ? "indemnités des élus, " : ""}documents de la mairie.`}
                    </p>
                    <ul className="tags">
                      {c.population !== null && <li className="tag">{formatEntier(c.population)} habitants</li>}
                      <li className="tag">
                        {formatEntier(c._count.documents)} {accord(c._count.documents, "document publié", "documents publiés")}
                      </li>
                      {c._count.operations > 0 && (
                        <li className="tag">
                          {formatEntier(c._count.operations)} {accord(c._count.operations, "chantier", "chantiers")}
                        </li>
                      )}
                    </ul>
                    <IconeFleche className="carte-fleche" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="explorer" aria-labelledby="titre-explorer">
        <div className="conteneur">
          <div className="section-tete">
            <div>
              <h2 id="titre-explorer">Explorer par région</h2>
              <p className="section-description">
                La plateforme démarre dans l&apos;Aude et s&apos;étend département par département.
              </p>
            </div>
            <Link prefetch={false} href="/regions" className="bouton bouton-secondaire">
              Tous les territoires
            </Link>
          </div>
          <ul className="tuiles-territoires">
            {regions.map((r) => {
              const couverts = r.departements.filter((d) => d.actif);
              const communes = couverts.reduce((s, d) => s + d._count.communes, 0);
              return (
                <li key={r.code}>
                  <Link prefetch={false} href={`/regions/${r.code}`} className={`tuile-territoire${couverts.length ? " couvert" : ""}`}>
                    <span className="tuile-territoire-nom">{r.nom}</span>
                    <span className="tuile-territoire-detail">
                      {r.departements.length} département{r.departements.length > 1 ? "s" : ""}
                    </span>
                    {couverts.length > 0 ? (
                      <span className="badge badge-ok">{formatEntier(communes)} communes couvertes</span>
                    ) : (
                      <span className="badge">Bientôt</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section section-teintee" aria-labelledby="titre-methode">
        <div className="conteneur">
          <div className="section-tete">
            <div>
              <h2 id="titre-methode">Comment ça marche</h2>
              <p className="section-description">Trois étapes, de la donnée publique au document vérifié.</p>
            </div>
          </div>
          <ol className="etapes">
            <li className="etape">
              <PictoDonnees />
              <h3>On rassemble l&apos;open data</h3>
              <p>
                Comptes des communes publiés par l&apos;OFGL, référentiels officiels&nbsp;: des données déjà publiques, mises en forme et
                comparées aux communes de même taille.
              </p>
            </li>
            <li className="etape">
              <PictoCourrier />
              <h3>On demande le reste aux mairies</h3>
              <p>
                Indemnités, frais, factures de travaux&nbsp;: une seule demande groupée par commune et par an, au titre du droit
                d&apos;accès aux documents administratifs (art. L.311-1 du CRPA).
              </p>
            </li>
            <li className="etape">
              <PictoOccultation />
              <h3>On occulte, puis on publie</h3>
              <p>
                Coordonnées personnelles, données bancaires, signatures&nbsp;: tout est masqué et vérifié à la main avant publication.
                Les indemnités et les frais des élus sont présentés par fonction&nbsp;; les délibérations, documents publics, sont
                reproduites telles quelles.
              </p>
            </li>
          </ol>
          <p className="section-suite">
            <Link prefetch={false} href="/methodologie" className="lien-fleche">
              Lire la méthodologie complète <IconeFleche taille={16} />
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-label="Pour aller plus loin">
        <div className="conteneur encarts">
          <div className="encart">
            <h2>Vous êtes élu ou agent d&apos;une mairie&nbsp;?</h2>
            <p>
              Nos demandes sont groupées une fois par an pour ne pas surcharger vos services. Une erreur sur une fiche, une mention qui
              aurait dû être masquée&nbsp;: écrivez-nous, nous corrigeons au plus vite.
            </p>
            {site.asso.email && (
              <a className="bouton bouton-secondaire" href={`mailto:${site.asso.email}`}>
                Écrire à l&apos;association
              </a>
            )}
          </div>
          <div className="encart">
            <h2>Des données ouvertes, réutilisables</h2>
            <p>
              Les comptes de chaque commune se téléchargent en CSV. Les données sont publiées sous Licence Ouverte 2.0 et le code de la plateforme sous
              licence AGPL&nbsp;: réutilisez-les librement, en citant la source.
            </p>
            <Link prefetch={false} className="bouton bouton-secondaire" href="/methodologie#sources">
              Voir les sources
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

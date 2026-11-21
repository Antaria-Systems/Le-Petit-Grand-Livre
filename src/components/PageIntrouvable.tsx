import Link from "next/link";
import { PictoDonnees } from "@/components/Icones";
import { RechercheCommune } from "@/components/RechercheCommune";

/** Contenu de la page 404 (titre de page propre, recherche, liens utiles). */
export function PageIntrouvable() {
  return (
    <section className="section">
      <div className="conteneur page-erreur">
        <div>
          <p className="erreur-code">Erreur 404</p>
          <h1>Page introuvable</h1>
          <p className="chapo">La page que vous cherchez n&apos;existe pas ou plus.</p>
          <p>
            Si vous avez saisi l&apos;adresse, vérifiez-la. La commune que vous cherchez n&apos;est peut-être pas encore couverte&nbsp;:
            la plateforme démarre dans l&apos;Aude.
          </p>
          <RechercheCommune />
          <div className="boutons-ligne">
            <Link prefetch={false} href="/" className="bouton bouton-principal">
              Page d&apos;accueil
            </Link>
            <Link prefetch={false} href="/regions" className="bouton">
              Tous les territoires
            </Link>
          </div>
        </div>
        <div className="page-erreur-picto" aria-hidden>
          <PictoDonnees />
        </div>
      </div>
    </section>
  );
}

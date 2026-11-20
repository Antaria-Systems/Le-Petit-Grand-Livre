import Link from "next/link";
import { site } from "@/lib/config";

export function Pied() {
  return (
    <footer className="pied">
      <div className="conteneur">
        <div className="pied-grille">
          <div>
            <h2>{site.nom}</h2>
            <p>
              Une plateforme indépendante éditée par {site.asso.nom || "une association"}. Ce site n&apos;est pas un
              service de l&apos;État ni d&apos;une collectivité.
            </p>
          </div>
          <div>
            <h2>Comprendre</h2>
            <ul>
              <li><Link href="/methodologie">Méthodologie et sources</Link></li>
              <li><Link href="/methodologie#cadre-juridique">Cadre juridique (CRPA)</Link></li>
              <li><Link href="/a-propos">À propos</Link></li>
            </ul>
          </div>
          <div>
            <h2>Légal</h2>
            <ul>
              <li><Link href="/mentions-legales">Mentions légales</Link></li>
              <li><Link href="/mentions-legales#donnees-personnelles">Données personnelles</Link></li>
            </ul>
          </div>
          <div>
            <h2>Ouvert</h2>
            <ul>
              <li>Code sous licence AGPL-3.0</li>
              <li>Données sous Licence Ouverte 2.0</li>
            </ul>
          </div>
        </div>
        <p className="pied-bas petit">
          Données financières : Observatoire des finances et de la gestion publique locales (OFGL). Référentiel
          géographique : geo.api.gouv.fr. Coordonnées des mairies : Annuaire de l&apos;administration (service-public.fr).
        </p>
      </div>
    </footer>
  );
}

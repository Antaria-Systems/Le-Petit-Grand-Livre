import Link from "next/link";
import { site } from "@/lib/config";
import { IconeExterne, LogoRegistre } from "./Icones";

const SOURCES = [
  { href: "https://data.ofgl.fr", libelle: "data.ofgl.fr" },
  { href: "https://www.cada.fr", libelle: "cada.fr" },
  { href: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000031366350", libelle: "legifrance.gouv.fr" },
  { href: "https://www.data.gouv.fr", libelle: "data.gouv.fr" },
];

export function Pied() {
  const mots = site.nom.split(" ");
  const moitie = Math.ceil(mots.length / 2);
  return (
    <footer className="pied" id="pied">
      <div className="pied-colonnes">
        <div className="conteneur">
          <div className="pied-grille">
            <div>
              <h2>Explorer</h2>
              <ul>
                <li>
                  <Link href="/regions">Tous les territoires</Link>
                </li>
                <li>
                  <Link href="/#recherche">Rechercher une commune</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Comprendre</h2>
              <ul>
                <li>
                  <Link href="/methodologie">Méthodologie et sources</Link>
                </li>
                <li>
                  <Link href="/methodologie#definitions">Définitions des indicateurs</Link>
                </li>
                <li>
                  <Link href="/methodologie#cadre-juridique">Cadre juridique (CRPA)</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>L&apos;association</h2>
              <ul>
                <li>
                  <Link href="/a-propos">Qui sommes-nous</Link>
                </li>
                <li>
                  <Link href="/a-propos#contact">Nous écrire</Link>
                </li>
                <li>
                  <Link href="/methodologie#erreurs">Signaler une erreur</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Ouvert</h2>
              <ul>
                <li>Code sous licence AGPL-3.0</li>
                <li>Données sous Licence Ouverte 2.0</li>
                <li>
                  <Link href="/mentions-legales#donnees-personnelles">Vos données personnelles</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="conteneur">
        <div className="pied-corps">
          <Link href="/" className="marque marque-pied" title={`${site.nom}, retour à l'accueil`}>
            <LogoRegistre taille={52} />
            <span className="marque-nom">
              {mots.slice(0, moitie).join(" ")}
              <br />
              {mots.slice(moitie).join(" ")}
            </span>
          </Link>
          <div className="pied-texte">
            <p>
              {site.nom} rassemble les comptes publics des communes et les documents obtenus auprès des mairies au titre du droit
              d&apos;accès aux documents administratifs. Plateforme indépendante éditée par {site.asso.nom ? `l'association ${site.asso.nom}` : "une association"} :
              ce n&apos;est pas un site de l&apos;État ni d&apos;une collectivité.
            </p>
            <ul className="pied-sources" aria-label="Sources et références">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" title={`${s.libelle}, nouvelle fenêtre`}>
                    {s.libelle}
                    <IconeExterne />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pied-bas">
          <ul>
            <li>
              <Link href="/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link href="/mentions-legales#donnees-personnelles">Données personnelles</Link>
            </li>
            <li>
              <Link href="/methodologie">Méthodologie</Link>
            </li>
            <li>
              <Link href="/a-propos">À propos</Link>
            </li>
          </ul>
          <p>
            Sauf mention contraire, les données de ce site sont publiées sous{" "}
            <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener noreferrer">
              Licence Ouverte 2.0
            </a>{" "}
            et son code sous licence AGPL-3.0. Comptes : OFGL · Référentiel géographique : geo.api.gouv.fr · Coordonnées des mairies :
            Annuaire de l&apos;administration.
          </p>
        </div>
      </div>
    </footer>
  );
}

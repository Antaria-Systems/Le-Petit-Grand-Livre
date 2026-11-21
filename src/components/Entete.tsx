import { site } from "@/lib/config";
import { EnteteSite } from "./EnteteSite";

export function Entete() {
  return (
    <>
      <nav className="liens-evitement" aria-label="Accès rapide">
        <ul>
          <li>
            <a href="#contenu">Contenu</a>
          </li>
          <li>
            <a href="#menu-principal">Menu</a>
          </li>
          <li>
            <a href="#pied">Pied de page</a>
          </li>
        </ul>
      </nav>
      <EnteteSite nom={site.nom} />
      {/* Sans JavaScript, le menu mobile ne peut pas s'ouvrir : la navigation est alors affichée telle quelle. */}
      <noscript>
        <style>{`.bouton-menu{display:none!important}.entete-menu{display:block!important;position:static!important;inset:auto!important;background:none!important;overflow:visible!important}.menu-tete,.menu-recherche,.menu-outils{display:none!important}`}</style>
      </noscript>
    </>
  );
}

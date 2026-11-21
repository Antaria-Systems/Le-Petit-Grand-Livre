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
    </>
  );
}

import Link from "next/link";
import { site } from "@/lib/config";
import { BoutonTheme } from "./BoutonTheme";
import { IconeLogo } from "./Icones";

export function Entete() {
  return (
    <>
      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>
      <header className="entete">
        <div className="conteneur">
          <Link href="/" className="marque">
            <span className="marque-logo">
              <IconeLogo />
            </span>
            {site.nom}
          </Link>
          <nav className="nav-principale" aria-label="Navigation principale">
            <Link href="/#explorer">Explorer</Link>
            <Link href="/methodologie" className="nav-secondaire">
              Méthodologie
            </Link>
            <Link href="/a-propos" className="nav-secondaire">
              À propos
            </Link>
            <BoutonTheme />
          </nav>
        </div>
      </header>
    </>
  );
}

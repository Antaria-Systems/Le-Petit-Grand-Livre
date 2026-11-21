"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoutonTheme } from "./BoutonTheme";
import { IconeFermer, IconeMenu, LogoRegistre } from "./Icones";
import { RechercheCommune } from "./RechercheCommune";

const LIENS: { href: string; libelle: string; rubrique: RegExp }[] = [
  { href: "/", libelle: "Accueil", rubrique: /^\/$/ },
  { href: "/regions", libelle: "Territoires", rubrique: /^\/(regions|departements|communes)(\/|$)/ },
  { href: "/methodologie", libelle: "Méthodologie", rubrique: /^\/methodologie/ },
  { href: "/a-propos", libelle: "À propos", rubrique: /^\/a-propos/ },
];

/** En-tête : marque, outils, navigation principale ; sous 992 px, la navigation passe dans un menu plein écran. */
export function EnteteSite({ nom }: { nom: string }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const boutonMenu = useRef<HTMLButtonElement>(null);
  const boutonFermer = useRef<HTMLButtonElement>(null);

  // Lien d'évitement « Menu » (#menu-principal) : sur mobile, il ouvre le menu.
  useEffect(() => {
    const ouvrirSiAncre = () => {
      if (window.location.hash === "#menu-principal" && window.matchMedia("(max-width: 991.98px)").matches) setOuvert(true);
    };
    window.addEventListener("hashchange", ouvrirSiAncre);
    return () => window.removeEventListener("hashchange", ouvrirSiAncre);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    document.body.classList.add("menu-ouvert");
    // Fenêtre modale : tout ce qui est sous le menu devient inerte (clavier et lecteurs d'écran).
    const dessous = [document.getElementById("contenu"), document.getElementById("pied"), document.querySelector(".entete-haut"), document.querySelector(".liens-evitement")].filter(
      (x): x is HTMLElement => x instanceof HTMLElement,
    );
    for (const el of dessous) el.inert = true;
    boutonFermer.current?.focus();
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        boutonMenu.current?.focus();
      }
    };
    document.addEventListener("keydown", echap);
    return () => {
      for (const el of dessous) el.inert = false;
      document.body.classList.remove("menu-ouvert");
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const mots = nom.split(" ");
  const moitie = Math.ceil(mots.length / 2);

  return (
    <header className="entete">
      <div className="conteneur entete-haut">
        <Link href="/" className="marque" title={`${nom}, retour à l'accueil`}>
          <LogoRegistre />
          <span className="marque-nom">
            {mots.slice(0, moitie).join(" ")}
            <br />
            {mots.slice(moitie).join(" ")}
          </span>
        </Link>
        <div className="marque-service">
          <p className="marque-titre">Les finances des communes, en clair</p>
          <p className="marque-devise">Plateforme associative indépendante</p>
        </div>
        <div className="entete-outils">
          <BoutonTheme avecLibelle />
          {chemin !== "/" && (
            <div className="entete-recherche">
              <RechercheCommune variante="compacte" />
            </div>
          )}
        </div>
        <button
          ref={boutonMenu}
          type="button"
          className="bouton-menu"
          aria-expanded={ouvert}
          aria-controls="menu-principal"
          onClick={() => setOuvert(true)}
        >
          <IconeMenu />
          <span>Menu</span>
        </button>
      </div>

      <div
        id="menu-principal"
        className={`entete-menu${ouvert ? " ouvert" : ""}`}
        {...(ouvert ? { role: "dialog", "aria-modal": true, "aria-label": "Menu" } : {})}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOuvert(false);
        }}
      >
        <div className="conteneur">
          <div className="menu-tete">
            <button
              ref={boutonFermer}
              type="button"
              className="bouton-fermer"
              onClick={() => {
                setOuvert(false);
                boutonMenu.current?.focus();
              }}
            >
              Fermer <IconeFermer taille={18} />
            </button>
          </div>
          <div className="menu-recherche">
            <RechercheCommune variante="compacte" />
          </div>
          <nav aria-label="Navigation principale">
            <ul className="nav-liens">
              {LIENS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={chemin === l.href ? "page" : l.rubrique.test(chemin) ? "true" : undefined}>
                    {l.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="menu-outils">
            <BoutonTheme avecLibelle />
          </div>
        </div>
      </div>
    </header>
  );
}

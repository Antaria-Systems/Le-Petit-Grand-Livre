"use client";

import { useEffect, useState } from "react";
import { IconeLune, IconeSoleil } from "./Icones";

type Theme = "light" | "dark";

function themeActuel(): Theme {
  const force = document.documentElement.dataset.theme;
  if (force === "light" || force === "dark") return force;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function BoutonTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(themeActuel()), []);

  function basculer() {
    const suivant: Theme = themeActuel() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = suivant;
    try {
      localStorage.setItem("theme", suivant);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    setTheme(suivant);
  }

  const libelle = theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre";
  return (
    <button type="button" className="bouton-theme" onClick={basculer} aria-label={libelle} title={libelle}>
      {theme === "dark" ? <IconeSoleil /> : <IconeLune />}
    </button>
  );
}

/** Script inline (avant le rendu) pour appliquer le thème mémorisé sans flash. */
export const scriptTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

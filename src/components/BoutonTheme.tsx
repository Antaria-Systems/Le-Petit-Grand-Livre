"use client";

import { useEffect, useState } from "react";
import { IconeLune, IconeSoleil } from "./Icones";

type Theme = "light" | "dark";

function themeActuel(): Theme {
  const force = document.documentElement.dataset.theme;
  if (force === "light" || force === "dark") return force;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function BoutonTheme({ avecLibelle = false }: { avecLibelle?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(themeActuel()), []);

  function basculer() {
    const suivant: Theme = themeActuel() === "dark" ? "light" : "dark";
    const appliquer = () => {
      document.documentElement.dataset.theme = suivant;
    };
    // Fondu enchaîné entre les deux thèmes quand le navigateur sait le faire (View Transitions).
    const doc = document as Document & { startViewTransition?: (maj: () => void) => unknown };
    if (doc.startViewTransition && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) doc.startViewTransition(appliquer);
    else appliquer();
    try {
      localStorage.setItem("theme", suivant);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    setTheme(suivant);
  }

  const libelle = theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre";
  if (avecLibelle)
    return (
      <button type="button" className="bouton-outil" onClick={basculer} title={libelle}>
        {theme === "dark" ? <IconeSoleil taille={16} /> : <IconeLune taille={16} />}
        {theme === "dark" ? "Thème clair" : "Thème sombre"}
      </button>
    );
  return (
    <button type="button" className="bouton-theme" onClick={basculer} aria-label={libelle} title={libelle}>
      {theme === "dark" ? <IconeSoleil /> : <IconeLune />}
    </button>
  );
}

/** Script inline (avant le rendu) pour appliquer le thème mémorisé sans flash. */
export const scriptTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

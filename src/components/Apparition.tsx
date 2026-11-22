"use client";

import { useEffect } from "react";

/**
 * Blocs révélés à leur arrivée dans la fenêtre (voir « Apparition au défilement » dans globals.css).
 * Ce qui est déjà à l'écran au chargement ne bouge pas ; sans JavaScript, ou si l'utilisateur
 * limite les animations, rien n'est jamais masqué.
 */
const CIBLES = [
  ".tuile",
  ".graphique",
  ".chantier",
  ".carte-une",
  ".tuiles-territoires > li",
  ".etape",
  ".sources-grille > .carte",
  ".chiffres-cles > div",
  ".classement",
  ".table-comparaison",
  ".territoire",
  ".encart",
].join(", ");

export function Apparition() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    const io = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          (entree.target as HTMLElement).dataset.apparition = "vu";
          io.unobserve(entree.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );

    // Au chargement, ce qui est déjà visible (ou plus haut) reste tel quel ; ensuite (navigation,
    // blocs dépliés), tout nouveau bloc apparaît.
    const suivre = (el: HTMLElement, auChargement: boolean) => {
      if (el.dataset.apparition) return;
      if (auChargement && el.getBoundingClientRect().top < window.innerHeight) return;
      el.dataset.apparition = "attente";
      io.observe(el);
    };
    document.querySelectorAll<HTMLElement>(CIBLES).forEach((el) => suivre(el, true));

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations)
        mutation.addedNodes.forEach((noeud) => {
          if (!(noeud instanceof HTMLElement)) return;
          if (noeud.matches(CIBLES)) suivre(noeud, false);
          noeud.querySelectorAll<HTMLElement>(CIBLES).forEach((el) => suivre(el, false));
        });
    });
    mo.observe(document.getElementById("contenu") ?? document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}

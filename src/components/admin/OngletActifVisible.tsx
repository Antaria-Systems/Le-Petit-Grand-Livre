"use client";

import { useEffect } from "react";

/** Sur petit écran, fait défiler la barre d'onglets jusqu'à l'onglet actif. */
export function OngletActifVisible() {
  useEffect(() => {
    const actif = document.querySelector<HTMLElement>('.onglets a[aria-current="page"]');
    actif?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return null;
}

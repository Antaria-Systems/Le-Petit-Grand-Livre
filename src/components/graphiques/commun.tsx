"use client";

import { useEffect, useRef, useState } from "react";
import { formatEuros, formatEurosCompact, formatParHabitant } from "@/lib/format";

export type FormatValeur = "euros" | "eurosHab";

export function formater(v: number, f: FormatValeur, compact = false): string {
  if (f === "eurosHab") return formatParHabitant(v);
  return compact ? formatEurosCompact(v) : formatEuros(v);
}

/** Graduations « rondes » de 0 (ou du minimum négatif) jusqu'au maximum. */
export function graduations(min: number, max: number, cible = 4): number[] {
  const bas = Math.min(0, min);
  const haut = max <= bas ? bas + 1 : max;
  const brut = (haut - bas) / cible;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut;
  const debut = Math.floor(bas / pas) * pas;
  const res: number[] = [];
  for (let v = debut; v < haut + pas * 0.999; v += pas) res.push(Math.round(v * 1e6) / 1e6);
  return res;
}

/** Largeur réelle du conteneur (le SVG est dessiné au pixel près, lisible sur mobile). */
export function useLargeur(defaut = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(defaut);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargeur(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, largeur };
}

export type LigneInfobulle = { couleur: string; libelle: string; valeur: string };

export function Infobulle({ x, y, titre, lignes }: { x: number; y: number; titre: string; lignes: LigneInfobulle[] }) {
  return (
    <div className="infobulle" style={{ left: x, top: y }} role="status">
      <div className="infobulle-titre">{titre}</div>
      {lignes.map((l) => (
        <div className="infobulle-ligne" key={l.libelle}>
          <span className="cle-ligne" style={{ background: l.couleur }} aria-hidden />
          <strong>{l.valeur}</strong>
          <span>{l.libelle}</span>
        </div>
      ))}
    </div>
  );
}

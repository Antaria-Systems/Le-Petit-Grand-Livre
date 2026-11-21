"use client";

import { useState } from "react";
import { formater, graduations, Infobulle, useLargeur, type FormatValeur } from "./commun";

export type SerieLigne = { id: string; libelle: string; couleur: string; valeurs: (number | null)[] };

type Props = {
  etiquettes: string[];
  series: SerieLigne[];
  format: FormatValeur;
  description: string;
  hauteur?: number;
};

const M = { haut: 12, bas: 28, gauche: 52, droite: 72 };

export function GraphiqueLignes({ etiquettes, series, format, description, hauteur = 240 }: Props) {
  const { ref, largeur } = useLargeur();
  const [actif, setActif] = useState<number | null>(null);

  const valeurs = series.flatMap((s) => s.valeurs.filter((v): v is number => v !== null));
  if (valeurs.length === 0) return null;
  const ticks = graduations(Math.min(...valeurs), Math.max(...valeurs));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const l = largeur - M.gauche - M.droite;
  const h = hauteur - M.haut - M.bas;
  const n = etiquettes.length;
  const x = (i: number) => M.gauche + (n === 1 ? l / 2 : (i * l) / (n - 1));
  const y = (v: number) => M.haut + h - ((v - yMin) / (yMax - yMin)) * h;

  // N'afficher qu'une étiquette d'abscisse sur deux si la place manque.
  const pasX = l / Math.max(1, n - 1) < 40 ? 2 : 1;

  // Étiquettes de fin de courbe, supprimées si elles se chevauchent (légende + infobulle prennent le relais).
  const fins = series
    .map((s) => {
      const i = s.valeurs.findLastIndex((v) => v !== null);
      return i < 0 ? null : { s, i, yv: y(s.valeurs[i]!) };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
  const finsTriees = [...fins].sort((a, b) => a.yv - b.yv);
  const chevauchement = finsTriees.some((f, k) => k > 0 && f.yv - finsTriees[k - 1].yv < 16);

  function survol(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n === 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setActif(Math.max(0, Math.min(n - 1, i)));
  }

  function clavier(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") setActif((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActif((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActif(null);
    else return;
    e.preventDefault();
  }

  return (
    <div>
      {series.length > 1 && (
        <ul className="legende">
          {series.map((s) => (
            <li key={s.id}>
              <span className="cle-ligne" style={{ background: s.couleur }} aria-hidden />
              {s.libelle}
            </li>
          ))}
        </ul>
      )}
      <div className="graphique-zone" ref={ref}>
        <svg
          width={largeur}
          height={hauteur}
          viewBox={`0 0 ${largeur} ${hauteur}`}
          role="img"
          aria-label={description}
          tabIndex={0}
          onKeyDown={clavier}
          onFocus={() => setActif((a) => a ?? n - 1)}
          onBlur={() => setActif(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.gauche} x2={M.gauche + l} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
              <text x={M.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--axis-text)" className="chiffres">
                {formater(t, format, true).replace(" €/hab.", " €")}
              </text>
            </g>
          ))}
          {etiquettes.map((e, i) =>
            (n - 1 - i) % pasX === 0 ? (
              <text key={e} x={x(i)} y={hauteur - 8} textAnchor="middle" fontSize={11} fill="var(--axis-text)" className="chiffres">
                {e}
              </text>
            ) : null,
          )}

          {series.map((s) => {
            let d = "";
            s.valeurs.forEach((v, i) => {
              if (v === null) return;
              const prec = i > 0 ? s.valeurs[i - 1] : null;
              d += `${prec === null || i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            });
            return <path key={s.id} d={d} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
          })}

          {fins.map(({ s, i, yv }) => (
            <g key={s.id}>
              <circle cx={x(i)} cy={yv} r={4} fill={s.couleur} stroke="var(--chart-surface)" strokeWidth={2} />
              {!chevauchement && (
                <text x={x(i) + 9} y={yv} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--ink)" className="chiffres">
                  {formater(s.valeurs[i]!, format, true)}
                </text>
              )}
            </g>
          ))}

          {actif !== null && (
            <g pointerEvents="none">
              <line x1={x(actif)} x2={x(actif)} y1={M.haut} y2={M.haut + h} stroke="var(--line-strong)" strokeWidth={1} />
              {series.map((s) =>
                s.valeurs[actif] === null ? null : (
                  <circle key={s.id} cx={x(actif)} cy={y(s.valeurs[actif]!)} r={4.5} fill={s.couleur} stroke="var(--chart-surface)" strokeWidth={2} />
                ),
              )}
            </g>
          )}

          <rect
            x={M.gauche - 12}
            y={0}
            width={l + 24}
            height={hauteur}
            fill="transparent"
            onPointerMove={survol}
            onPointerLeave={() => setActif(null)}
          />
        </svg>
        {actif !== null && (
          <Infobulle
            x={Math.min(Math.max(x(actif), 80), largeur - 80)}
            y={Math.min(...series.map((s) => (s.valeurs[actif] === null ? hauteur : y(s.valeurs[actif]!))))}
            titre={etiquettes[actif]}
            lignes={series
              .filter((s) => s.valeurs[actif] !== null)
              .map((s) => ({ couleur: s.couleur, libelle: s.libelle, valeur: formater(s.valeurs[actif]!, format) }))}
          />
        )}
      </div>
    </div>
  );
}

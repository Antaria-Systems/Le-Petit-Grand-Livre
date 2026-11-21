"use client";

import { useState } from "react";
import { formater, graduations, Infobulle, useLargeur, type FormatValeur } from "./commun";

type Props = {
  etiquettes: string[];
  valeurs: (number | null)[];
  libelle: string;
  couleur: string;
  format: FormatValeur;
  description: string;
  /** Index de la colonne dont la valeur est écrite sur le chapeau (sélection courante). */
  indexEtiquete?: number;
  hauteur?: number;
};

const M = { haut: 22, bas: 28, gauche: 52, droite: 8 };

/** Colonne à extrémité arrondie (4px), carrée sur la ligne de base. */
function chemin(x: number, w: number, yHaut: number, yBase: number) {
  const r = Math.min(4, w / 2, Math.abs(yBase - yHaut));
  if (yHaut <= yBase) {
    return `M${x},${yBase}V${yHaut + r}Q${x},${yHaut} ${x + r},${yHaut}H${x + w - r}Q${x + w},${yHaut} ${x + w},${yHaut + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yHaut - r}Q${x},${yHaut} ${x + r},${yHaut}H${x + w - r}Q${x + w},${yHaut} ${x + w},${yHaut - r}V${yBase}Z`;
}

export function GraphiqueColonnes({ etiquettes, valeurs, libelle, couleur, format, description, indexEtiquete, hauteur = 220 }: Props) {
  const { ref, largeur } = useLargeur();
  const [actif, setActif] = useState<number | null>(null);

  const presentes = valeurs.filter((v): v is number => v !== null);
  if (presentes.length === 0) return null;
  const ticks = graduations(Math.min(...presentes), Math.max(...presentes));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const l = largeur - M.gauche - M.droite;
  const h = hauteur - M.haut - M.bas;
  const n = etiquettes.length;
  const bande = l / n;
  const w = Math.min(24, bande * 0.6);
  const y = (v: number) => M.haut + h - ((v - yMin) / (yMax - yMin)) * h;
  const yBase = y(0);
  const xc = (i: number) => M.gauche + bande * i + bande / 2;
  const pasX = bande < 36 ? 2 : 1;
  // Étiquettes ancrées sur la dernière année ; l'année sélectionnée s'affiche toujours et masque ses voisines.
  const ancree = (i: number) => (n - 1 - i) % pasX === 0;
  const montrerEtiquette = (i: number) =>
    i === indexEtiquete ||
    (ancree(i) && !(indexEtiquete !== undefined && !ancree(indexEtiquete) && Math.abs(i - indexEtiquete) === 1));

  return (
    <div className="graphique-zone" ref={ref}>
      <svg
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="img"
        aria-label={`${description} : ${etiquettes.map((e, i) => `${e} ${valeurs[i] === null ? "donnée indisponible" : formater(valeurs[i]!, format)}`).join(", ")}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.gauche} x2={M.gauche + l} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
            <text x={M.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--axis-text)" className="chiffres">
              {formater(t, format, true).replace(" €/hab.", " €")}
            </text>
          </g>
        ))}
        {valeurs.map((v, i) => (
          <g key={etiquettes[i]}>
            {v !== null && (
              <path
                d={chemin(xc(i) - w / 2, w, y(v), yBase)}
                fill={couleur}
                opacity={actif === null || actif === i ? 1 : 0.55}
              />
            )}
            {montrerEtiquette(i) && (
              <text x={xc(i)} y={hauteur - 8} textAnchor="middle" fontSize={11} fill="var(--axis-text)" className="chiffres">
                {etiquettes[i]}
              </text>
            )}
            {i === indexEtiquete && v !== null && (
              // Aux extrémités, l'étiquette s'aligne sur la colonne pour ne pas déborder sur la voisine.
              <text
                x={i === n - 1 && n > 1 ? xc(i) + w / 2 : i === 0 && n > 1 ? xc(i) - w / 2 : xc(i)}
                // Étiquette décalée au-dessus de la colonne voisine qu'elle chevauche (aux extrémités).
                y={
                  Math.min(
                    y(v),
                    yBase,
                    i === n - 1 && n > 1 && valeurs[i - 1] !== null ? y(valeurs[i - 1]!) : Infinity,
                    i === 0 && n > 1 && valeurs[1] !== null ? y(valeurs[1]!) : Infinity,
                  ) - 7
                }
                textAnchor={i === n - 1 && n > 1 ? "end" : i === 0 && n > 1 ? "start" : "middle"}
                fontSize={12}
                fontWeight={600}
                fill="var(--ink)"
                className="chiffres"
              >
                {formater(v, format, true)}
              </text>
            )}
            {/* Zone de survol : toute la bande, plus large que la colonne */}
            <rect
              x={M.gauche + bande * i}
              y={M.haut}
              width={bande}
              height={h}
              fill="transparent"
              onPointerEnter={() => setActif(i)}
              onPointerLeave={() => setActif(null)}
            />
          </g>
        ))}
      </svg>
      {actif !== null && valeurs[actif] !== null && (
        <Infobulle
          x={Math.min(Math.max(xc(actif), 80), largeur - 80)}
          y={Math.min(y(valeurs[actif]!), yBase)}
          titre={etiquettes[actif]}
          lignes={[{ couleur, libelle, valeur: formater(valeurs[actif]!, format) }]}
        />
      )}
    </div>
  );
}

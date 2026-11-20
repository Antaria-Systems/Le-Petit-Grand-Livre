"use client";

import { useState } from "react";
import { formatEuros, formatPourcentage } from "@/lib/format";
import { Infobulle, useLargeur } from "./commun";

export type Part = { libelle: string; valeur: number; couleur: string; encre: string };

/** Un tout découpé en parts : blocs de 28px, part écrite dans le bloc quand elle y tient. */
export function BarreSegmentee({ parts, description }: { parts: Part[]; description: string }) {
  const { ref, largeur } = useLargeur();
  const [actif, setActif] = useState<number | null>(null);
  const visibles = parts.filter((p) => p.valeur > 0);
  const total = visibles.reduce((s, p) => s + p.valeur, 0);
  if (total <= 0) return null;

  const espace = 2 * (visibles.length - 1);
  let cumul = 0;
  const blocs = visibles.map((p) => {
    const w = ((largeur - espace) * p.valeur) / total;
    const debut = cumul;
    cumul += w + 2;
    const texte = formatPourcentage(p.valeur / total);
    return { ...p, w, debut, texte, tient: w >= texte.length * 7.5 + 12 };
  });

  return (
    <div>
      <div className="graphique-zone" ref={ref}>
        <div className="barre-segmentee" role="group" aria-label={description}>
          {blocs.map((b, i) => (
            <div
              key={b.libelle}
              style={{ flex: `${b.valeur} 0 0`, background: b.couleur, color: b.encre }}
              tabIndex={0}
              aria-label={`${b.libelle} : ${formatEuros(b.valeur)} (${b.texte})`}
              onPointerEnter={() => setActif(i)}
              onPointerLeave={() => setActif(null)}
              onFocus={() => setActif(i)}
              onBlur={() => setActif(null)}
            >
              {b.tient ? b.texte : ""}
            </div>
          ))}
        </div>
        {actif !== null && (
          <Infobulle
            x={Math.min(Math.max(blocs[actif].debut + blocs[actif].w / 2, 90), largeur - 90)}
            y={0}
            titre={`${blocs[actif].libelle} · ${blocs[actif].texte}`}
            lignes={[{ couleur: blocs[actif].couleur, libelle: "", valeur: formatEuros(blocs[actif].valeur) }]}
          />
        )}
      </div>
      <ul className="legende">
        {blocs.map((b) => (
          <li key={b.libelle}>
            <span className="cle-carre" style={{ background: b.couleur }} aria-hidden />
            {b.libelle}
            {!b.tient && <span className="discret"> ({b.texte})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

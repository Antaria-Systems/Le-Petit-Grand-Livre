"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { formatEntier } from "@/lib/format";
import { normaliser } from "@/lib/texte";

type C = { nom: string; slug: string; population: number | null; cle: string };

export function FiltreCommunes({ communes }: { communes: C[] }) {
  const [q, setQ] = useState("");
  // La liste (433 liens et plus) se met à jour en différé : la saisie reste fluide.
  const qDiffere = useDeferredValue(q);
  const filtrees = useMemo(() => {
    const n = normaliser(qDiffere).replace(/\bste\b/g, "sainte").replace(/\bst\b/g, "saint");
    return n ? communes.filter((c) => c.cle.includes(n)) : communes;
  }, [qDiffere, communes]);

  const parLettre = new Map<string, C[]>();
  for (const c of filtrees) {
    const l = c.cle[0]?.toUpperCase() ?? "#";
    if (!parLettre.has(l)) parLettre.set(l, []);
    parLettre.get(l)!.push(c);
  }

  return (
    <>
      <div className="filtre-communes">
        <div className="champ">
          <label htmlFor="filtre">Filtrer les communes</label>
          <input id="filtre" type="search" placeholder="Nom de la commune" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <p className="filtre-compte" aria-live="polite">
          <strong className="chiffres">{formatEntier(filtrees.length)}</strong> commune{filtrees.length > 1 ? "s" : ""}
        </p>
      </div>
      {parLettre.size > 1 && (
        <nav className="index-lettres" aria-label="Aller à la lettre">
          {[...parLettre.keys()].map((l) => (
            <a key={l} href={`#lettre-${l}`}>
              {l}
            </a>
          ))}
        </nav>
      )}
      {filtrees.length === 0 && (
        <div className="vide">
          <strong>Aucune commune ne correspond à « {q} ».</strong>
          <p>
            <button type="button" className="bouton" onClick={() => setQ("")}>
              Effacer le filtre
            </button>
          </p>
        </div>
      )}
      <div className="lettres">
        {[...parLettre].map(([lettre, liste]) => (
          <section key={lettre} className="lettre" aria-labelledby={`lettre-${lettre}`}>
            <h2 id={`lettre-${lettre}`}>{lettre}</h2>
            <ul className="liste-communes">
              {liste.map((c) => (
                <li key={c.slug}>
                  <Link prefetch={false} href={`/communes/${c.slug}`}>
                    <span>{c.nom}</span>
                    {c.population !== null && <span className="discret chiffres">{formatEntier(c.population)} hab.</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

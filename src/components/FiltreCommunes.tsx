"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEntier } from "@/lib/format";
import { normaliser } from "@/lib/texte";

type C = { nom: string; slug: string; population: number | null; cle: string };

export function FiltreCommunes({ communes }: { communes: C[] }) {
  const [q, setQ] = useState("");
  const filtrees = useMemo(() => {
    const n = normaliser(q);
    return n ? communes.filter((c) => c.cle.includes(n)) : communes;
  }, [q, communes]);

  const parLettre = new Map<string, C[]>();
  for (const c of filtrees) {
    const l = c.cle[0]?.toUpperCase() ?? "#";
    if (!parLettre.has(l)) parLettre.set(l, []);
    parLettre.get(l)!.push(c);
  }

  return (
    <>
      <div className="filtre-communes">
        <label htmlFor="filtre" className="sr-only">
          Filtrer les communes
        </label>
        <input id="filtre" type="search" placeholder="Filtrer les communes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="discret petit" aria-live="polite" style={{ margin: "6px 0 0" }}>
          {filtrees.length} commune{filtrees.length > 1 ? "s" : ""}
        </p>
      </div>
      <div className="lettres">
        {[...parLettre].map(([lettre, liste]) => (
          <section key={lettre} className="lettre" aria-labelledby={`lettre-${lettre}`}>
            <h2 id={`lettre-${lettre}`}>{lettre}</h2>
            <ul className="liste-communes">
              {liste.map((c) => (
                <li key={c.slug}>
                  <Link href={`/communes/${c.slug}`}>
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

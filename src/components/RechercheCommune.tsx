"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { ResultatRecherche } from "@/app/api/communes/route";
import { formatEntier } from "@/lib/format";
import { IconeRecherche } from "./Icones";

/** Champ de recherche de commune (combobox ARIA : flèches, Entrée, Échap). */
export function RechercheCommune() {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const requete = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultats([]);
      return;
    }
    const t = setTimeout(async () => {
      requete.current?.abort();
      const ctrl = new AbortController();
      requete.current = ctrl;
      try {
        const res = await fetch(`/api/communes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as ResultatRecherche[];
        setResultats(data);
        setActif(data.length ? 0 : -1);
        setOuvert(true);
      } catch {
        /* requête annulée ou réseau indisponible */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  function aller(r: ResultatRecherche) {
    setOuvert(false);
    router.push(`/communes/${r.slug}`);
  }

  function clavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ouvert || resultats.length === 0) return;
    if (e.key === "ArrowDown") setActif((a) => (a + 1) % resultats.length);
    else if (e.key === "ArrowUp") setActif((a) => (a - 1 + resultats.length) % resultats.length);
    else if (e.key === "Enter" && actif >= 0) aller(resultats[actif]);
    else if (e.key === "Escape") setOuvert(false);
    else return;
    e.preventDefault();
  }

  const montrer = ouvert && q.trim().length >= 2;
  return (
    <div className="recherche">
      <label htmlFor={`${id}-champ`}>Rechercher une commune</label>
      <IconeRecherche className="recherche-icone" />
      <input
        id={`${id}-champ`}
        className="recherche-champ"
        type="search"
        placeholder="Nom ou code postal, ex. Lavalette ou 11290"
        autoComplete="off"
        role="combobox"
        aria-expanded={montrer}
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        aria-activedescendant={montrer && actif >= 0 ? `${id}-opt-${actif}` : undefined}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={clavier}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
      />
      {montrer && (
        <ul className="recherche-resultats" id={`${id}-liste`} role="listbox" aria-label="Communes trouvées">
          {resultats.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled>
              <span className="discret">Aucune commune couverte ne correspond. La plateforme couvre pour l&apos;instant l&apos;Aude.</span>
            </li>
          ) : (
            resultats.map((r, i) => (
              <li
                key={r.slug}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === actif}
                onMouseDown={(e) => {
                  e.preventDefault();
                  aller(r);
                }}
                onMouseEnter={() => setActif(i)}
              >
                <span>
                  <strong>{r.nom}</strong> <span className="discret">{r.codesPostaux[0]}</span>
                </span>
                <span className="discret">
                  {r.departement}
                  {r.population ? ` · ${formatEntier(r.population)} hab.` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

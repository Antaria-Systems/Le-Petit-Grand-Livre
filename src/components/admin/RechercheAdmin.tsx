"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ResultatRecherche } from "@/lib/recherche";

/** Recherche de commune dans la barre d'administration (Ctrl+K) : ouvre la fiche d'administration. */
export function RechercheAdmin() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [actif, setActif] = useState(0);

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        champ.current?.focus();
        champ.current?.select();
      }
    };
    window.addEventListener("keydown", raccourci);
    return () => window.removeEventListener("keydown", raccourci);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setResultats([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/communes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((r: ResultatRecherche[]) => {
          setResultats(r);
          setActif(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const code = (r: ResultatRecherche) => r.slug.split("-").pop()!.toUpperCase();
  const aller = (r: ResultatRecherche) => {
    setQ("");
    setResultats([]);
    router.push(`/admin/communes/${code(r)}`);
  };

  return (
    <div className="recherche-admin">
      <label htmlFor="recherche-admin" className="sr-only">
        Ouvrir une commune dans l&apos;administration
      </label>
      <input
        ref={champ}
        id="recherche-admin"
        type="search"
        placeholder="Commune… (Ctrl+K)"
        autoComplete="off"
        role="combobox"
        aria-expanded={resultats.length > 0}
        aria-controls="recherche-admin-liste"
        aria-activedescendant={resultats.length ? `recherche-admin-${actif}` : undefined}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!resultats.length) return;
          if (e.key === "ArrowDown") setActif((a) => (a + 1) % resultats.length);
          else if (e.key === "ArrowUp") setActif((a) => (a - 1 + resultats.length) % resultats.length);
          else if (e.key === "Enter") aller(resultats[actif]);
          else if (e.key === "Escape") setResultats([]);
          else return;
          e.preventDefault();
        }}
        onBlur={() => setTimeout(() => setResultats([]), 150)}
      />
      {resultats.length > 0 && (
        <ul id="recherche-admin-liste" role="listbox" className="recherche-admin-liste">
          {resultats.map((r, i) => (
            <li
              key={r.slug}
              id={`recherche-admin-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseDown={(e) => {
                e.preventDefault();
                aller(r);
              }}
            >
              <strong>{r.nom}</strong> <span className="discret">{r.departement}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

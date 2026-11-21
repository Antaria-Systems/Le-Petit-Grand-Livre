"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { ResultatRecherche } from "@/lib/recherche";
import { formatEntier } from "@/lib/format";
import { IconeRecherche } from "./Icones";

/**
 * Champ de recherche de commune (combobox ARIA : flèches, Entrée, Échap).
 * « grande » : accueil, avec libellé et bouton ; « compacte » : en-tête.
 */
export function RechercheCommune({
  variante = "grande",
  valeurInitiale = "",
}: {
  variante?: "grande" | "compacte";
  valeurInitiale?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(valeurInitiale);
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
        const res = await fetch(`/api/communes?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
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
    else if (e.key === "ArrowUp")
      setActif((a) => (a - 1 + resultats.length) % resultats.length);
    else if (e.key === "Enter" && actif >= 0) aller(resultats[actif]);
    else if (e.key === "Escape") setOuvert(false);
    else return;
    e.preventDefault();
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const r = resultats[actif >= 0 ? actif : 0];
    if (r && q.trim().length >= 2) aller(r);
    else if (q.trim().length >= 2) router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
    else setOuvert(true);
  }

  const montrer = ouvert && q.trim().length >= 2;
  const grande = variante === "grande";
  return (
    <form
      role="search"
      action="/recherche"
      className={`recherche recherche-${variante}`}
      onSubmit={soumettre}
    >
      <label
        htmlFor={`${id}-champ`}
        className={grande ? "recherche-libelle" : "sr-only"}
      >
        Rechercher une commune
      </label>
      {grande && (
        <p className="recherche-aide" id={`${id}-aide`}>
          Nom de la commune ou code postal
        </p>
      )}
      <div className="recherche-barre">
        <input
          id={`${id}-champ`}
          className="recherche-champ"
          name="q"
          type="search"
          aria-describedby={grande ? `${id}-aide` : undefined}
          placeholder={
            grande ? "Ex. Lavalette ou 11290" : "Rechercher une commune"
          }
          autoComplete="off"
          role="combobox"
          aria-expanded={montrer}
          aria-controls={`${id}-liste`}
          aria-autocomplete="list"
          aria-activedescendant={
            montrer && actif >= 0 ? `${id}-opt-${actif}` : undefined
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={clavier}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
        />
        <button type="submit" className="recherche-bouton" title="Rechercher">
          <IconeRecherche taille={grande ? 20 : 18} />
          <span className={grande ? undefined : "sr-only"}>Rechercher</span>
        </button>
      </div>
      {montrer && (
        <ul
          className="recherche-resultats"
          id={`${id}-liste`}
          role="listbox"
          aria-label="Communes trouvées"
        >
          {resultats.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled>
              <span className="discret">
                Aucune commune ne correspond à « {q.trim()} ». Vérifiez
                l&apos;orthographe ou essayez le code postal (la plateforme couvre
                pour l&apos;instant l&apos;Aude).
              </span>
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
                  <strong>{r.nom}</strong>{" "}
                  <span className="discret">{r.codesPostaux[0]}</span>
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
    </form>
  );
}

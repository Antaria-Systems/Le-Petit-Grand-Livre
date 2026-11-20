"use client";

import { useMemo, useState } from "react";
import { formatDateCourte, formatEuros, formatEurosCompact } from "@/lib/format";
import { CATEGORIE_DOCUMENT } from "@/lib/statuts";
import type { Chantier } from "@/lib/travaux";

const STATUT = {
  REALISEE: { libelle: "Réalisé", classe: "badge-ok" },
  EN_COURS: { libelle: "En cours", classe: "badge-attente" },
  PREVUE: { libelle: "Voté, à venir", classe: "badge-accent" },
} as const;

const dateDoc = (d: { date: string | null; annee: number | null }) => (d.date ? formatDateCourte(new Date(`${d.date}T12:00:00Z`)) : d.annee ? String(d.annee) : "—");

/** Classement des chantiers par montant facturé (barres horizontales, cliquables). */
export function ClassementChantiers({ chantiers }: { chantiers: Chantier[] }) {
  const [survol, setSurvol] = useState<string | null>(null);
  const avecFactures = chantiers.filter((c) => c.facture > 0);
  const max = Math.max(...avecFactures.map((c) => c.facture), 1);
  return (
    <ol className="classement" aria-label="Montants facturés par chantier">
      {avecFactures.map((c) => (
        <li key={c.slug} className={survol && survol !== c.slug ? "classement-attenue" : undefined}>
          <a href={`#chantier-${c.slug}`} onPointerEnter={() => setSurvol(c.slug)} onPointerLeave={() => setSurvol(null)} onFocus={() => setSurvol(c.slug)} onBlur={() => setSurvol(null)}>
            <span className="classement-ligne">
              <span className="classement-libelle">{c.intitule}</span>
              <span className="classement-valeur chiffres">{formatEurosCompact(c.facture)}</span>
            </span>
            <span className="classement-piste" aria-hidden>
              <span className="classement-barre" style={{ width: `${(c.facture / max) * 100}%` }} />
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Fiches chantier, filtrables par catégorie. */
export function ListeChantiers({ chantiers }: { chantiers: Chantier[] }) {
  const categories = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of chantiers) if (x.categorie) c.set(x.categorie, (c.get(x.categorie) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }, [chantiers]);
  const [filtre, setFiltre] = useState<string | null>(null);
  const visibles = filtre ? chantiers.filter((c) => c.categorie === filtre) : chantiers;

  return (
    <>
      <div className="puces" role="group" aria-label="Filtrer les chantiers">
        <button type="button" className="puce" aria-pressed={filtre === null} onClick={() => setFiltre(null)}>
          Tous <span className="puce-compte">{chantiers.length}</span>
        </button>
        {categories.map(([cat, nb]) => (
          <button type="button" key={cat} className="puce" aria-pressed={filtre === cat} onClick={() => setFiltre(cat)}>
            {cat} <span className="puce-compte">{nb}</span>
          </button>
        ))}
      </div>
      <div className="chantiers">
        {visibles.map((c) => {
          const statut = STATUT[c.statut];
          const progression = c.montantVote && c.facture ? Math.min(1, c.facture / c.montantVote) : null;
          return (
            <article key={c.slug} id={`chantier-${c.slug}`} className="carte chantier">
              <header className="chantier-entete">
                <p className="surtitre">{c.categorie ?? "Travaux"}</p>
                <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
              </header>
              <h3>{c.intitule}</h3>
              <p className="chantier-meta">
                {[c.lieu, c.prestataire].filter(Boolean).join(" · ")}
                {c.debut && c.fin ? ` · ${c.debut.slice(0, 4) === c.fin.slice(0, 4) ? c.debut.slice(0, 4) : `${c.debut.slice(0, 4)}–${c.fin.slice(0, 4)}`}` : ""}
              </p>
              <dl className="chantier-chiffres">
                {(c.montantVote !== null || c.montantVoteHT !== null) && (
                  <div>
                    <dt>Voté ou commandé</dt>
                    <dd className="chiffres">{c.montantVote !== null ? `${formatEuros(c.montantVote)} TTC` : `${formatEuros(c.montantVoteHT!)} HT`}</dd>
                  </div>
                )}
                <div>
                  <dt>Facturé</dt>
                  <dd className="chiffres">
                    {c.facture > 0 ? `${formatEuros(c.facture)} TTC` : "—"}
                    {c.nbFactures > 0 && <span className="discret"> · {c.nbFactures} facture{c.nbFactures > 1 ? "s" : ""}</span>}
                  </dd>
                </div>
                {c.subventions > 0 && (
                  <div>
                    <dt>Subventions reçues</dt>
                    <dd className="chiffres">{formatEuros(c.subventions)}</dd>
                  </div>
                )}
              </dl>
              {progression !== null && (
                <div className="jauge" role="img" aria-label={`${Math.round(progression * 100)} % du montant voté a été facturé`}>
                  <div className="jauge-remplie" style={{ width: `${progression * 100}%` }} />
                </div>
              )}
              {c.description && <p className="chantier-description">{c.description}</p>}
              <details className="chantier-documents">
                <summary>
                  {c.documents.length} document{c.documents.length > 1 ? "s" : ""} du chantier
                </summary>
                <ol className="chronologie-docs">
                  {c.documents.map((d) => (
                    <li key={d.id}>
                      <time className="chiffres">{dateDoc(d)}</time>
                      <span className={`type-doc type-${d.categorie.toLowerCase()}`}>{CATEGORIE_DOCUMENT[d.categorie]}</span>
                      <a href={`/documents/${d.id}`} target="_blank" rel="noopener">
                        {d.titre}
                      </a>
                      <span className="chiffres montant">{d.montantTTC !== null ? formatEuros(d.montantTTC) : ""}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { CategorieDocument } from "@/generated/prisma/enums";
import { formatDateCourte, formatEuros } from "@/lib/format";
import { CATEGORIE_DOCUMENT } from "@/lib/statuts";
import { normaliser } from "@/lib/texte";
import type { DocumentFiche } from "@/lib/travaux";

const PAR_PAGE = 15;
type Tri = "date" | "montant";

export function BibliothequeDocuments({ documents }: { documents: DocumentFiche[] }) {
  const [type, setType] = useState<CategorieDocument | null>(null);
  const [q, setQ] = useState("");
  const [tri, setTri] = useState<Tri>("date");
  const [limite, setLimite] = useState(PAR_PAGE);

  const types = useMemo(() => {
    const c = new Map<CategorieDocument, number>();
    for (const d of documents) c.set(d.categorie, (c.get(d.categorie) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }, [documents]);

  const index = useMemo(
    () => documents.map((d) => ({ d, cle: normaliser([d.titre, d.entreprise, d.objet, d.chantier?.intitule].filter(Boolean).join(" ")) })),
    [documents],
  );

  const resultats = useMemo(() => {
    const n = normaliser(q);
    const liste = index.filter((x) => (!type || x.d.categorie === type) && (!n || n.split(" ").every((m) => x.cle.includes(m)))).map((x) => x.d);
    if (tri === "montant") return [...liste].sort((a, b) => (b.montantTTC ?? -1) - (a.montantTTC ?? -1));
    return liste;
  }, [index, type, q, tri]);

  const changer = (f: () => void) => {
    f();
    setLimite(PAR_PAGE);
  };

  return (
    <div className="bibliotheque">
      <div className="bibliotheque-outils">
        <div className="puces" role="group" aria-label="Filtrer par type de document">
          <button type="button" className="puce" aria-pressed={type === null} onClick={() => changer(() => setType(null))}>
            Tous <span className="puce-compte">{documents.length}</span>
          </button>
          {types.map(([t, nb]) => (
            <button type="button" key={t} className="puce" aria-pressed={type === t} onClick={() => changer(() => setType(t))}>
              {CATEGORIE_DOCUMENT[t]} <span className="puce-compte">{nb}</span>
            </button>
          ))}
        </div>
        <div className="bibliotheque-recherche">
          <label className="sr-only" htmlFor="recherche-documents">
            Rechercher un document
          </label>
          <input
            id="recherche-documents"
            type="search"
            placeholder="Entreprise, chantier, objet…"
            value={q}
            onChange={(e) => changer(() => setQ(e.target.value))}
          />
          <label className="sr-only" htmlFor="tri-documents">
            Trier
          </label>
          <select id="tri-documents" value={tri} onChange={(e) => changer(() => setTri(e.target.value as Tri))}>
            <option value="date">Plus récents</option>
            <option value="montant">Montant décroissant</option>
          </select>
        </div>
      </div>

      <p className="discret petit" aria-live="polite">
        {resultats.length} document{resultats.length > 1 ? "s" : ""}
      </p>
      <ul className="liste-documents">
        {resultats.slice(0, limite).map((d) => (
          <li key={d.id}>
            <span className={`type-doc type-${d.categorie.toLowerCase()}`}>{CATEGORIE_DOCUMENT[d.categorie]}</span>
            <div className="doc-corps">
              <a href={`/documents/${d.id}`} target="_blank" rel="noopener" className="doc-titre">
                {d.titre}
              </a>
              <p className="doc-meta">
                {d.date ? formatDateCourte(new Date(`${d.date}T12:00:00Z`)) : d.annee ?? "Date non relevée"}
                {d.entreprise ? ` · ${d.entreprise}` : ""}
                {d.chantier && (
                  <>
                    {" · "}
                    <a href={`#chantier-${d.chantier.slug}`}>{d.chantier.intitule}</a>
                  </>
                )}
                {d.copie ? " · second exemplaire" : ""}
              </p>
            </div>
            <div className="doc-droite">
              {d.montantTTC !== null && <span className="doc-montant chiffres">{formatEuros(d.montantTTC)}</span>}
              <span className="discret petit">PDF{d.nbPages ? ` · ${d.nbPages} p.` : ""}</span>
            </div>
          </li>
        ))}
      </ul>
      {resultats.length > limite && (
        <button type="button" className="bouton" onClick={() => setLimite((l) => l + 30)}>
          Afficher plus ({resultats.length - limite} restants)
        </button>
      )}
    </div>
  );
}

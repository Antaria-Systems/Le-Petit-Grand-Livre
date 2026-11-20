"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CategorieDocument, MotifOccultation, StatutDocument, TravailDocument } from "@/generated/prisma/enums";
import { CATEGORIES, MOTIFS } from "@/lib/admin-schemas";
import { CATEGORIE_DOCUMENT, MOTIF_OCCULTATION, STATUT_DOCUMENT } from "@/lib/statuts";

type Zone = {
  id: string;
  page: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  motif: MotifOccultation;
  source: "AUTO" | "MANUEL";
  validee: boolean;
};

type Doc = {
  id: string;
  titre: string;
  categorie: CategorieDocument;
  annee: number | null;
  notes: string | null;
  statut: StatutDocument;
  travail: TravailDocument | null;
  erreur: string | null;
  nomOriginal: string;
  aVersionPublique: boolean;
};

type Page = { numero: number; largeur: number; hauteur: number };
type Trace = { page: number; x0: number; y0: number; x1: number; y1: number };

async function appel(url: string, methode: string, corps?: unknown) {
  const res = await fetch(url, {
    method: methode,
    headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.erreur ?? `Erreur ${res.status}`);
  return json;
}

export function EditeurOccultation({ document: initial, pages, zonesInitiales }: { document: Doc; pages: Page[]; zonesInitiales: Zone[] }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [zones, setZones] = useState(zonesInitiales);
  const [selection, setSelection] = useState<string | null>(null);
  const [motif, setMotif] = useState<MotifOccultation>("SIGNATURE");
  const [transparence, setTransparence] = useState(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [meta, setMeta] = useState({ titre: initial.titre, categorie: initial.categorie, annee: initial.annee?.toString() ?? "", notes: initial.notes ?? "" });

  /* ─────────── Zoom de la visionneuse (indépendant du zoom du navigateur) ─────────── */
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4;
  const [zoom, setZoom] = useState(1);
  const [modeDeplacement, setModeDeplacement] = useState(false);
  const visionneuse = useRef<HTMLDivElement>(null);
  const zoomActuel = useRef(1);
  const ancre = useRef<{ x: number; y: number; facteur: number; gauche: number; haut: number } | null>(null);
  const glissement = useRef<{ x: number; y: number; gauche: number; haut: number } | null>(null);

  /** Change le zoom en gardant immobile le point visé (curseur, ou centre de la visionneuse). */
  const zoomer = useCallback((cible: number, point?: { x: number; y: number }) => {
    const v = visionneuse.current;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(cible * 100) / 100));
    if (!v || z === zoomActuel.current) return;
    ancre.current = {
      x: point?.x ?? v.clientWidth / 2,
      y: point?.y ?? v.clientHeight / 2,
      facteur: z / zoomActuel.current,
      gauche: v.scrollLeft,
      haut: v.scrollTop,
    };
    zoomActuel.current = z;
    setZoom(z);
    try {
      localStorage.setItem("editeur-zoom", String(z));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useLayoutEffect(() => {
    const v = visionneuse.current;
    const a = ancre.current;
    if (!v || !a) return;
    v.scrollLeft = (a.gauche + a.x) * a.facteur - a.x;
    v.scrollTop = (a.haut + a.y) * a.facteur - a.y;
    ancre.current = null;
  }, [zoom]);

  useEffect(() => {
    try {
      const memo = Number(localStorage.getItem("editeur-zoom"));
      if (memo >= ZOOM_MIN && memo <= ZOOM_MAX) {
        zoomActuel.current = memo;
        setZoom(memo);
      }
    } catch {
      /* stockage indisponible */
    }
    // Ctrl + molette (ou pincement sur pavé tactile) : zoom sur le curseur, sans zoomer toute la page.
    const v = visionneuse.current;
    if (!v) return;
    const roue = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = v.getBoundingClientRect();
      zoomer(zoomActuel.current * Math.exp(-e.deltaY * 0.0025), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    v.addEventListener("wheel", roue, { passive: false });
    return () => v.removeEventListener("wheel", roue);
  }, [zoomer]);

  useEffect(() => {
    // Les zones sont des boutons : Espace doit déplacer la vue même quand une zone a le focus.
    const dansChamp = (e: KeyboardEvent) => (e.target as HTMLElement).closest("input, select, textarea");
    function bas(e: KeyboardEvent) {
      if (dansChamp(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomer(zoomActuel.current * 1.25);
      else if (e.key === "-") zoomer(zoomActuel.current / 1.25);
      else if (e.key === "0") zoomer(1);
      else if (e.code === "Space") setModeDeplacement(true);
      else return;
      e.preventDefault();
    }
    function haut(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      setModeDeplacement(false);
      if (!dansChamp(e)) e.preventDefault(); // pas de « clic » sur le bouton qui a le focus
    }
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
    };
  }, [zoomer]);

  /** Espace + glisser : déplacement dans la page zoomée (le tracé de zones est suspendu). */
  function debutDeplacement(e: React.PointerEvent<HTMLDivElement>) {
    if (!modeDeplacement || !visionneuse.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    glissement.current = { x: e.clientX, y: e.clientY, gauche: visionneuse.current.scrollLeft, haut: visionneuse.current.scrollTop };
  }

  function deplacementVue(e: React.PointerEvent<HTMLDivElement>) {
    const g = glissement.current;
    if (!g || !visionneuse.current) return;
    visionneuse.current.scrollLeft = g.gauche - (e.clientX - g.x);
    visionneuse.current.scrollTop = g.haut - (e.clientY - g.y);
  }

  const aVerifier = zones.filter((z) => !z.validee).length;
  const zoneSel = zones.find((z) => z.id === selection) ?? null;

  const signaler = (type: "ok" | "erreur", texte: string) => setMessage({ type, texte });

  // Les modifications de zones dépublient / invalident la version occultée côté serveur : on reflète ce statut.
  const marquerModifie = () =>
    setDoc((d) => (d.statut === "OCCULTE" || d.statut === "PUBLIE" ? { ...d, statut: "A_VERIFIER" } : d));

  /* ─────────── Suivi du worker ─────────── */
  useEffect(() => {
    if (!doc.travail) return;
    const t = setInterval(async () => {
      const etat = await appel(`/api/admin/documents/${doc.id}`, "GET").catch(() => null);
      if (etat && !etat.travail) {
        clearInterval(t);
        if (etat.erreur) signaler("erreur", etat.erreur);
        else signaler("ok", "Traitement terminé.");
        router.refresh();
        setDoc((d) => ({ ...d, ...etat }));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [doc.travail, doc.id, router]);

  useEffect(() => setZones(zonesInitiales), [zonesInitiales]);

  /* ─────────── Zones ─────────── */
  const modifierZone = useCallback(async (id: string, patch: Partial<Zone>) => {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    try {
      await appel(`/api/admin/zones/${id}`, "PATCH", patch);
      marquerModifie();
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }, []);

  const supprimerZone = useCallback(async (id: string) => {
    setZones((zs) => zs.filter((z) => z.id !== id));
    setSelection(null);
    try {
      await appel(`/api/admin/zones/${id}`, "DELETE");
      marquerModifie();
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }, []);

  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if (!selection || (e.target as HTMLElement).closest("input, select, textarea")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        supprimerZone(selection);
      } else if (e.key === "Enter") {
        e.preventDefault();
        modifierZone(selection, { validee: true });
      } else if (e.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [selection, supprimerZone, modifierZone]);

  /* ─────────── Tracé d'une nouvelle zone ─────────── */
  function position(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  function debut(e: React.PointerEvent<HTMLDivElement>, page: number) {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = position(e);
    setSelection(null);
    setTrace({ page, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }

  function deplacement(e: React.PointerEvent<HTMLDivElement>) {
    if (!trace) return;
    const p = position(e);
    setTrace({ ...trace, x1: p.x, y1: p.y });
  }

  async function fin() {
    if (!trace) return;
    const t = trace;
    setTrace(null);
    const rect = { x: Math.min(t.x0, t.x1), y: Math.min(t.y0, t.y1), largeur: Math.abs(t.x1 - t.x0), hauteur: Math.abs(t.y1 - t.y0) };
    if (rect.largeur < 0.005 || rect.hauteur < 0.004) return; // simple clic
    try {
      const zone = (await appel(`/api/admin/documents/${doc.id}/zones`, "POST", { ...rect, page: t.page, motif })) as Zone;
      setZones((zs) => [...zs, zone]);
      setSelection(zone.id);
      marquerModifie();
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }

  /* ─────────── Actions sur le document ─────────── */
  async function action(nom: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setOccupe(true);
    setMessage(null);
    try {
      await appel(`/api/admin/documents/${doc.id}/action`, "POST", { action: nom });
      if (nom === "valider-tout") setZones((zs) => zs.map((z) => ({ ...z, validee: true })));
      if (nom === "generer") setDoc((d) => ({ ...d, travail: "GENERER" }));
      if (nom === "reanalyser") setDoc((d) => ({ ...d, travail: "ANALYSER", statut: "RECU" }));
      if (nom === "publier") setDoc((d) => ({ ...d, statut: "PUBLIE" }));
      if (nom === "depublier") setDoc((d) => ({ ...d, statut: d.aVersionPublique ? "OCCULTE" : "A_VERIFIER" }));
      if (nom === "non-publiable") setDoc((d) => ({ ...d, statut: "NON_PUBLIABLE" }));
      signaler("ok", nom === "generer" ? "Génération lancée…" : "Fait.");
    } catch (e) {
      signaler("erreur", (e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrerMeta(e: React.FormEvent) {
    e.preventDefault();
    try {
      await appel(`/api/admin/documents/${doc.id}`, "PATCH", {
        titre: meta.titre,
        categorie: meta.categorie,
        annee: meta.annee ? Number(meta.annee) : null,
        notes: meta.notes || null,
      });
      signaler("ok", "Informations enregistrées.");
    } catch (err) {
      signaler("erreur", (err as Error).message);
    }
  }

  const statut = STATUT_DOCUMENT[doc.statut];
  const enCours = !!doc.travail;

  return (
    <div className="editeur">
      <div className="editeur-pages">
        <h1 style={{ fontSize: "1.5rem" }}>{doc.titre}</h1>
        <p className="discret petit">Fichier d&apos;origine : {doc.nomOriginal}</p>
        {pages.length === 0 && (
          <div className="vide">
            <strong>{enCours ? "Analyse en cours…" : "Aucune page analysée."}</strong>
          </div>
        )}
        {pages.length > 0 && (
          <div className="barre-zoom" role="toolbar" aria-label="Zoom">
            <button type="button" className="bouton" onClick={() => zoomer(zoom / 1.25)} disabled={zoom <= ZOOM_MIN} aria-label="Dézoomer">
              −
            </button>
            <button type="button" className="bouton zoom-valeur" onClick={() => zoomer(1)} title="Revenir à la largeur (0)">
              {Math.round(zoom * 100)} %
            </button>
            <button type="button" className="bouton" onClick={() => zoomer(zoom * 1.25)} disabled={zoom >= ZOOM_MAX} aria-label="Zoomer">
              +
            </button>
            <span className="discret petit">
              <kbd>Ctrl</kbd> + molette pour zoomer · <kbd>Espace</kbd> + glisser pour se déplacer
            </span>
          </div>
        )}
        <div
          ref={visionneuse}
          className={`visionneuse${modeDeplacement ? " mode-deplacement" : ""}${pages.length === 0 ? " visionneuse-vide" : ""}`}
          onPointerDownCapture={debutDeplacement}
          onPointerMove={deplacementVue}
          onPointerUp={() => (glissement.current = null)}
          onPointerCancel={() => (glissement.current = null)}
        >
          <div className="visionneuse-contenu" style={{ width: `${zoom * 100}%` }}>
        {pages.map((p) => (
          <figure key={p.numero} className="page-doc">
            <figcaption className="discret petit">
              Page {p.numero} / {pages.length}
            </figcaption>
            <div className="page-cadre" style={{ aspectRatio: `${p.largeur} / ${p.hauteur}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/documents/${doc.id}/pages/${p.numero}`} alt={`Page ${p.numero}`} loading="lazy" draggable={false} />
              <div
                className="page-calque"
                onPointerDown={(e) => debut(e, p.numero)}
                onPointerMove={deplacement}
                onPointerUp={fin}
                onPointerCancel={() => setTrace(null)}
              >
                {zones
                  .filter((z) => z.page === p.numero)
                  .map((z) => (
                    <button
                      type="button"
                      key={z.id}
                      className={`zone ${z.validee ? "zone-validee" : "zone-proposee"} ${transparence ? "zone-transparente" : ""} ${selection === z.id ? "zone-selection" : ""}`}
                      style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.largeur * 100}%`, height: `${z.hauteur * 100}%` }}
                      title={`${MOTIF_OCCULTATION[z.motif]}${z.validee ? "" : " (proposée)"}`}
                      aria-label={`Zone ${MOTIF_OCCULTATION[z.motif]}, ${z.validee ? "validée" : "à vérifier"}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setSelection(z.id)}
                    />
                  ))}
                {trace?.page === p.numero && (
                  <div
                    className="zone zone-trace"
                    style={{
                      left: `${Math.min(trace.x0, trace.x1) * 100}%`,
                      top: `${Math.min(trace.y0, trace.y1) * 100}%`,
                      width: `${Math.abs(trace.x1 - trace.x0) * 100}%`,
                      height: `${Math.abs(trace.y1 - trace.y0) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </figure>
        ))}
          </div>
        </div>
      </div>

      <aside className="editeur-panneau">
        <div className="carte">
          <p style={{ margin: "0 0 8px" }}>
            <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
            {enCours && <span className="discret petit"> · {doc.travail === "ANALYSER" ? "analyse" : "génération"} en cours…</span>}
          </p>
          {doc.erreur && <p className="badge badge-alerte" style={{ whiteSpace: "normal" }}>{doc.erreur}</p>}
          <p className="petit" style={{ margin: "0 0 12px" }}>
            {zones.length} zone{zones.length > 1 ? "s" : ""} · <strong>{aVerifier}</strong> à vérifier
          </p>

          <label className="champ">
            <span>Motif des nouvelles zones</span>
            <select value={motif} onChange={(e) => setMotif(e.target.value as MotifOccultation)}>
              {MOTIFS.map((m) => (
                <option key={m} value={m}>
                  {MOTIF_OCCULTATION[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="case">
            <input type="checkbox" checked={transparence} onChange={(e) => setTransparence(e.target.checked)} /> Voir sous les masques
          </label>
          <p className="discret petit">
            Tracez un rectangle sur la page pour masquer. Cliquez une zone pour la modifier · <kbd>Entrée</kbd> valider · <kbd>Suppr</kbd>{" "}
            supprimer.
          </p>

          {zoneSel && (
            <div className="zone-panneau">
              <strong className="petit">
                Zone page {zoneSel.page} · {zoneSel.source === "AUTO" ? "détectée" : "manuelle"}
              </strong>
              <select value={zoneSel.motif} onChange={(e) => modifierZone(zoneSel.id, { motif: e.target.value as MotifOccultation })}>
                {MOTIFS.map((m) => (
                  <option key={m} value={m}>
                    {MOTIF_OCCULTATION[m]}
                  </option>
                ))}
              </select>
              <div className="boutons">
                {!zoneSel.validee && (
                  <button type="button" className="bouton bouton-principal" onClick={() => modifierZone(zoneSel.id, { validee: true })}>
                    Valider
                  </button>
                )}
                <button type="button" className="bouton" onClick={() => supprimerZone(zoneSel.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          )}

          <div className="boutons" style={{ marginTop: 12 }}>
            <button type="button" className="bouton" disabled={occupe || aVerifier === 0} onClick={() => action("valider-tout")}>
              Tout valider ({aVerifier})
            </button>
            <button
              type="button"
              className="bouton bouton-principal"
              disabled={occupe || enCours || aVerifier > 0 || pages.length === 0}
              onClick={() => action("generer")}
            >
              Générer la version occultée
            </button>
            {doc.aVersionPublique && (
              <a className="bouton" href={`/api/admin/documents/${doc.id}/public`} target="_blank" rel="noreferrer">
                Prévisualiser
              </a>
            )}
            {doc.statut === "OCCULTE" && (
              <button type="button" className="bouton bouton-principal" disabled={occupe} onClick={() => action("publier", "Publier ce document sur la fiche de la commune ?")}>
                Publier
              </button>
            )}
            {doc.statut === "PUBLIE" && (
              <button type="button" className="bouton" disabled={occupe} onClick={() => action("depublier")}>
                Dépublier
              </button>
            )}
            {doc.statut !== "NON_PUBLIABLE" && (
              <button type="button" className="bouton" disabled={occupe} onClick={() => action("non-publiable", "Marquer ce document comme non publiable ?")}>
                Non publiable
              </button>
            )}
            <button
              type="button"
              className="bouton"
              disabled={occupe || enCours}
              onClick={() => action("reanalyser", "Relancer l'analyse ? Les zones proposées non validées seront recalculées.")}
            >
              Réanalyser
            </button>
          </div>
          {message && (
            <p className={`badge ${message.type === "ok" ? "badge-ok" : "badge-alerte"}`} role="status" style={{ marginTop: 12, whiteSpace: "normal" }}>
              {message.texte}
            </p>
          )}
        </div>

        <form className="carte" onSubmit={enregistrerMeta} style={{ marginTop: 12 }}>
          <h2 style={{ fontSize: "1rem" }}>Informations</h2>
          <label className="champ">
            <span>Titre public</span>
            <input value={meta.titre} onChange={(e) => setMeta({ ...meta, titre: e.target.value })} required maxLength={200} />
          </label>
          <label className="champ">
            <span>Catégorie</span>
            <select value={meta.categorie} onChange={(e) => setMeta({ ...meta, categorie: e.target.value as CategorieDocument })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIE_DOCUMENT[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Année</span>
            <input type="number" min={1990} max={2100} value={meta.annee} onChange={(e) => setMeta({ ...meta, annee: e.target.value })} />
          </label>
          <label className="champ">
            <span>Notes internes</span>
            <textarea rows={3} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
          </label>
          <button type="submit" className="bouton">
            Enregistrer
          </button>
        </form>
      </aside>
    </div>
  );
}

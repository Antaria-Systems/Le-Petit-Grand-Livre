"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CategorieDocument, MotifOccultation, StatutDocument, TravailDocument } from "@/generated/prisma/enums";
import { CATEGORIES, MOTIFS } from "@/lib/admin-schemas";
import { lireMontant } from "@/lib/montant";
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
  entreprise: string | null;
  objet: string | null;
  montantTTC: number | null;
  montantHT: number | null;
  dateDocument: string | null;
  copie: boolean;
  operationId: number | null;
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

type Navigation = { precedentId: string | null; suivantId: string | null; position: number | null; total: number };
type Source = { id: string; titre: string; nbZones: number };
type Manipulation = { id: string; mode: "deplacer" | "nw" | "ne" | "sw" | "se"; x0: number; y0: number; origine: Zone; cadre: DOMRect; bouge: boolean };

/**
 * Ordre de lecture des zones : page, puis par ligne (tolérance de 1 % de la hauteur, pour qu'un
 * téléphone et un courriel sur la même ligne se suivent de gauche à droite), puis de gauche à droite.
 */
const ordre = (a: Zone, b: Zone) => a.page - b.page || Math.round(a.y * 100) - Math.round(b.y * 100) || a.x - b.x;

/** Position lisible d'une zone : « en haut à droite », pour savoir laquelle on supprime. */
function positionZone(z: Pick<Zone, "x" | "y" | "largeur" | "hauteur">): string {
  const cy = z.y + z.hauteur / 2;
  const cx = z.x + z.largeur / 2;
  const v = cy < 0.33 ? "en haut" : cy < 0.66 ? "au milieu" : "en bas";
  const h = cx < 0.33 ? "à gauche" : cx < 0.66 ? "au centre" : "à droite";
  return `${v} ${h}`;
}

const CLE_DERNIER_TERMINE = "lpgl-dernier-termine";

/** Prochaine zone à vérifier après (ou avant) une zone donnée, en bouclant. */
function prochaineAVerifier(apres: Zone | null, liste: Zone[], sens: 1 | -1 = 1): Zone | null {
  const aVoir = liste.filter((z) => !z.validee).sort(ordre);
  if (aVoir.length === 0) return null;
  if (!apres) return sens > 0 ? aVoir[0] : aVoir[aVoir.length - 1];
  if (sens > 0) return aVoir.find((z) => z.id !== apres.id && ordre(z, apres) > 0) ?? aVoir.find((z) => z.id !== apres.id) ?? null;
  return [...aVoir].reverse().find((z) => z.id !== apres.id && ordre(z, apres) < 0) ?? [...aVoir].reverse().find((z) => z.id !== apres.id) ?? null;
}

export function EditeurOccultation({
  document: initial,
  pages,
  zonesInitiales,
  navigation,
  sources,
  chantiers,
}: {
  document: Doc;
  pages: Page[];
  zonesInitiales: Zone[];
  navigation: Navigation;
  sources: Source[];
  chantiers: { id: number; intitule: string }[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [zones, setZones] = useState(zonesInitiales);
  const [selection, setSelection] = useState<string | null>(null);
  const [source, setSource] = useState(sources[0]?.id ?? "");
  const zonesRef = useRef(zones);
  const zonesDom = useRef(new Map<string, HTMLButtonElement>());
  const manipulation = useRef<Manipulation | null>(null);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  const [motif, setMotif] = useState<MotifOccultation>("SIGNATURE");
  const [transparence, setTransparence] = useState(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const metaInitiale = {
    titre: initial.titre,
    categorie: initial.categorie,
    annee: initial.annee?.toString() ?? "",
    notes: initial.notes ?? "",
    entreprise: initial.entreprise ?? "",
    objet: initial.objet ?? "",
    montantTTC: initial.montantTTC?.toString().replace(".", ",") ?? "",
    montantHT: initial.montantHT?.toString().replace(".", ",") ?? "",
    dateDocument: initial.dateDocument ?? "",
    copie: initial.copie,
    operationId: initial.operationId?.toString() ?? "",
  };
  const [meta, setMeta] = useState(metaInitiale);
  const [metaEnregistree, setMetaEnregistree] = useState(() => JSON.stringify(metaInitiale));
  const metaModifiee = JSON.stringify(meta) !== metaEnregistree;
  const [derniereSupprimee, setDerniereSupprimee] = useState<Zone | null>(null);
  const [alertePrecedent, setAlertePrecedent] = useState<{ id: string; titre: string; erreur: string } | null>(null);

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

  /* ─────────── Document terminé juste avant : bloqué par le contrôle avant publication ? ─────────── */
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(CLE_DERNIER_TERMINE);
    } catch {
      return;
    }
    if (!id || id === doc.id) return;
    const surveille = id;
    const debutSuivi = Date.now();
    const t = setInterval(async () => {
      const etat = await appel(`/api/admin/documents/${surveille}`, "GET").catch(() => null);
      if (!etat) return;
      if (etat.travail && Date.now() - debutSuivi < 15 * 60_000) return; // génération encore en cours
      clearInterval(t);
      try {
        sessionStorage.removeItem(CLE_DERNIER_TERMINE);
      } catch {
        /* rien */
      }
      if (etat.statut !== "PUBLIE") {
        setAlertePrecedent({ id: surveille, titre: etat.titre ?? "document", erreur: etat.erreur ?? `statut « ${STATUT_DOCUMENT[etat.statut as StatutDocument]?.libelle ?? etat.statut} »` });
      }
    }, 4000);
    return () => clearInterval(t);
  }, [doc.id]);

  /* ─────────── Modifications non enregistrées : avertissement en quittant la page ─────────── */
  useEffect(() => {
    if (!metaModifiee) return;
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [metaModifiee]);

  /* ─────────── Hauteur de la visionneuse : tout l'espace sous sa position réelle ─────────── */
  useLayoutEffect(() => {
    const v = visionneuse.current;
    if (!v) return;
    const ajuster = () => {
      const haut = v.getBoundingClientRect().top + window.scrollY;
      v.style.height = `max(420px, calc(100dvh - ${Math.round(Math.min(haut, 480))}px - 16px))`;
    };
    ajuster();
    window.addEventListener("resize", ajuster);
    return () => window.removeEventListener("resize", ajuster);
  }, [pages.length]);

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
    const zone = zonesRef.current.find((z) => z.id === id);
    if (zone) setDerniereSupprimee(zone);
    setZones((zs) => zs.filter((z) => z.id !== id));
    setSelection(null);
    try {
      await appel(`/api/admin/zones/${id}`, "DELETE");
      marquerModifie();
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }, []);

  /** Sélectionne une zone, la centre dans la visionneuse et lui donne le focus clavier. */
  const selectionner = useCallback((id: string | null) => {
    setSelection(id);
    if (!id) return;
    requestAnimationFrame(() => {
      const el = zonesDom.current.get(id);
      el?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }, []);

  /** Valide (ou supprime) une zone puis enchaîne sur la prochaine zone à vérifier. */
  const validerEtSuivre = useCallback(
    (id: string) => {
      const courante = zonesRef.current.find((z) => z.id === id) ?? null;
      modifierZone(id, { validee: true });
      selectionner(prochaineAVerifier(courante, zonesRef.current.map((z) => (z.id === id ? { ...z, validee: true } : z)))?.id ?? null);
    },
    [modifierZone, selectionner],
  );

  const supprimerEtSuivre = useCallback(
    (id: string) => {
      const courante = zonesRef.current.find((z) => z.id === id) ?? null;
      supprimerZone(id);
      selectionner(prochaineAVerifier(courante, zonesRef.current.filter((z) => z.id !== id))?.id ?? null);
    },
    [supprimerZone, selectionner],
  );

  const terminerRef = useRef<() => void>(() => {});
  const restaurerRef = useRef<() => void>(() => {});

  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
      // Ctrl + Entrée : terminer le document et passer au suivant
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        terminerRef.current();
        return;
      }
      // Ctrl + Z : rétablir la dernière zone supprimée
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        restaurerRef.current();
        return;
      }
      // Tab / Maj + Tab : parcourir les zones à vérifier (seulement depuis la page ou une zone)
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
        const actif = document.activeElement;
        if (actif && actif !== document.body && !actif.classList.contains("zone")) return;
        const courante = zonesRef.current.find((z) => z.id === selection) ?? null;
        const suivante = prochaineAVerifier(courante, zonesRef.current, e.shiftKey ? -1 : 1);
        if (!suivante) return;
        e.preventDefault();
        selectionner(suivante.id);
        return;
      }
      if (!selection) return;
      // Suppr uniquement : Retour arrière, trop facile à frapper par erreur, ne supprime rien.
      if (e.key === "Delete") {
        e.preventDefault();
        supprimerEtSuivre(selection);
      } else if (e.key === "Enter") {
        e.preventDefault();
        validerEtSuivre(selection);
      } else if (e.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [selection, selectionner, supprimerEtSuivre, validerEtSuivre]);

  /* ─────────── Déplacer / redimensionner une zone ─────────── */
  function debutManipulation(e: React.PointerEvent, z: Zone, mode: Manipulation["mode"]) {
    if (e.button !== 0) return;
    e.stopPropagation(); // pas de tracé de nouvelle zone
    const zoneEl = (e.currentTarget as HTMLElement).closest(".zone") as HTMLElement;
    const cadre = (zoneEl.closest(".page-calque") as HTMLElement).getBoundingClientRect();
    zoneEl.setPointerCapture(e.pointerId);
    setSelection(z.id);
    manipulation.current = { id: z.id, mode, x0: e.clientX, y0: e.clientY, origine: { ...z }, cadre, bouge: false };
  }

  function mouvementManipulation(e: React.PointerEvent) {
    const m = manipulation.current;
    if (!m) return;
    if (!m.bouge && Math.abs(e.clientX - m.x0) + Math.abs(e.clientY - m.y0) < 4) return;
    m.bouge = true;
    const dx = (e.clientX - m.x0) / m.cadre.width;
    const dy = (e.clientY - m.y0) / m.cadre.height;
    const o = m.origine;
    const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    let r: Pick<Zone, "x" | "y" | "largeur" | "hauteur">;
    if (m.mode === "deplacer") {
      r = { x: borne(o.x + dx, 0, 1 - o.largeur), y: borne(o.y + dy, 0, 1 - o.hauteur), largeur: o.largeur, hauteur: o.hauteur };
    } else {
      let [x0, y0, x1, y1] = [o.x, o.y, o.x + o.largeur, o.y + o.hauteur];
      if (m.mode.includes("w")) x0 = borne(x0 + dx, 0, x1 - 0.005);
      if (m.mode.includes("e")) x1 = borne(x1 + dx, x0 + 0.005, 1);
      if (m.mode.includes("n")) y0 = borne(y0 + dy, 0, y1 - 0.004);
      if (m.mode.includes("s")) y1 = borne(y1 + dy, y0 + 0.004, 1);
      r = { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
    }
    setZones((zs) => zs.map((z) => (z.id === m.id ? { ...z, ...r } : z)));
  }

  function finManipulation() {
    const m = manipulation.current;
    manipulation.current = null;
    if (!m?.bouge) return;
    const z = zonesRef.current.find((x) => x.id === m.id);
    if (z) modifierZone(z.id, { x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur });
  }

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

  /** Tout valider, générer, publier automatiquement, puis ouvrir le document suivant à vérifier. */
  async function terminer() {
    if (occupe || doc.travail || pages.length === 0 || doc.statut === "NON_PUBLIABLE" || doc.statut === "PUBLIE") return;
    const restantes = zonesRef.current.filter((z) => !z.validee).length;
    if (restantes > 0 && !window.confirm(`${restantes} zone(s) proposée(s) n'ont pas été vérifiées une par une. Les valider toutes et publier ?`)) return;
    setOccupe(true);
    if (metaModifiee && !(await sauverMeta())) {
      setOccupe(false);
      return;
    }
    try {
      await appel(`/api/admin/documents/${doc.id}/action`, "POST", { action: "terminer" });
      try {
        sessionStorage.setItem(CLE_DERNIER_TERMINE, doc.id);
      } catch {
        /* stockage indisponible : pas de suivi du document précédent */
      }
      router.push(navigation.suivantId ? `/admin/documents/${navigation.suivantId}` : "/admin/documents?statut=A_VERIFIER");
    } catch (e) {
      signaler("erreur", (e as Error).message);
      setOccupe(false);
    }
  }
  terminerRef.current = terminer;

  /** Rétablit la dernière zone supprimée (même emplacement, même motif, validée). */
  async function restaurer() {
    const z = derniereSupprimee;
    if (!z) return;
    setDerniereSupprimee(null);
    try {
      const zone = (await appel(`/api/admin/documents/${doc.id}/zones`, "POST", { page: z.page, x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur, motif: z.motif })) as Zone;
      setZones((zs) => [...zs, zone]);
      selectionner(zone.id);
      marquerModifie();
      signaler("ok", "Zone rétablie.");
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }
  restaurerRef.current = restaurer;

  /** Navigation vers un autre document : les informations modifiées sont d'abord enregistrées. */
  async function naviguer(url: string) {
    if (metaModifiee && !(await sauverMeta())) return;
    router.push(url);
  }

  async function copierZones() {
    if (!source) return;
    try {
      const { zones: nouvelles } = (await appel(`/api/admin/documents/${doc.id}/copier-zones`, "POST", { depuis: source })) as { zones: Zone[] };
      setZones((zs) => [...zs, ...nouvelles]);
      marquerModifie();
      signaler("ok", `${nouvelles.length} zone(s) reprise(s), à vérifier (Tab pour les parcourir).`);
      selectionner([...nouvelles].sort(ordre)[0]?.id ?? null);
    } catch (e) {
      signaler("erreur", (e as Error).message);
    }
  }

  /** Enregistre les informations ; renvoie false (et affiche l'erreur) si la saisie est invalide. */
  async function sauverMeta(): Promise<boolean> {
    const montants = { montantTTC: meta.montantTTC.trim(), montantHT: meta.montantHT.trim() };
    const lus = { montantTTC: montants.montantTTC ? lireMontant(montants.montantTTC) : null, montantHT: montants.montantHT ? lireMontant(montants.montantHT) : null };
    for (const [champ, valeur] of Object.entries(lus)) {
      if (valeur !== null && !Number.isFinite(valeur)) {
        signaler("erreur", `${champ === "montantTTC" ? "Montant TTC" : "Montant HT"} illisible (« ${montants[champ as keyof typeof montants]} ») : saisissez par exemple 1 234,56. Rien n'a été enregistré.`);
        return false;
      }
    }
    try {
      await appel(`/api/admin/documents/${doc.id}`, "PATCH", {
        titre: meta.titre,
        categorie: meta.categorie,
        annee: meta.annee ? Number(meta.annee) : null,
        notes: meta.notes || null,
        entreprise: meta.entreprise || null,
        objet: meta.objet || null,
        montantTTC: lus.montantTTC,
        montantHT: lus.montantHT,
        dateDocument: meta.dateDocument || null,
        copie: meta.copie,
        operationId: meta.operationId ? Number(meta.operationId) : null,
      });
      setMetaEnregistree(JSON.stringify(meta));
      signaler("ok", "Informations enregistrées.");
      return true;
    } catch (err) {
      signaler("erreur", `Informations non enregistrées : ${(err as Error).message}`);
      return false;
    }
  }

  async function enregistrerMeta(e: React.FormEvent) {
    e.preventDefault();
    await sauverMeta();
  }

  const statut = STATUT_DOCUMENT[doc.statut];
  const enCours = !!doc.travail;

  return (
    <div className="editeur">
      <div className="editeur-pages">
        <nav className="nav-verification" aria-label="Documents à vérifier">
          {navigation.precedentId ? (
            <Link
              href={`/admin/documents/${navigation.precedentId}`}
              onClick={(e) => {
                if (!metaModifiee) return;
                e.preventDefault();
                naviguer(`/admin/documents/${navigation.precedentId}`);
              }}
            >
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="discret petit">
            {navigation.total === 0
              ? "Aucun autre document à vérifier"
              : navigation.position
                ? `Document ${navigation.position} sur ${navigation.total} à vérifier`
                : `${navigation.total} document${navigation.total > 1 ? "s" : ""} à vérifier`}
          </span>
          {navigation.suivantId ? (
            <Link
              href={`/admin/documents/${navigation.suivantId}`}
              onClick={(e) => {
                if (!metaModifiee) return;
                e.preventDefault();
                naviguer(`/admin/documents/${navigation.suivantId}`);
              }}
            >
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </nav>
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
                      ref={(el) => {
                        if (el) zonesDom.current.set(z.id, el);
                        else zonesDom.current.delete(z.id);
                      }}
                      className={`zone ${z.validee ? "zone-validee" : "zone-proposee"} ${transparence ? "zone-transparente" : ""} ${selection === z.id ? "zone-selection" : ""}`}
                      style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.largeur * 100}%`, height: `${z.hauteur * 100}%` }}
                      title={`${MOTIF_OCCULTATION[z.motif]}, ${positionZone(z)}${z.validee ? "" : " (proposée)"}`}
                      aria-label={`Zone ${MOTIF_OCCULTATION[z.motif]}, page ${z.page} ${positionZone(z)}, ${z.validee ? "validée" : "à vérifier"}`}
                      onPointerDown={(e) => debutManipulation(e, z, "deplacer")}
                      onPointerMove={mouvementManipulation}
                      onPointerUp={finManipulation}
                      onPointerCancel={finManipulation}
                      onClick={() => setSelection(z.id)}
                    >
                      {selection === z.id &&
                        (["nw", "ne", "sw", "se"] as const).map((coin) => (
                          <span key={coin} className={`poignee poignee-${coin}`} aria-hidden onPointerDown={(e) => debutManipulation(e, z, coin)} />
                        ))}
                    </button>
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
          {alertePrecedent && (
            <p className="alerte alerte-urgent" role="alert">
              Le document précédent, <Link href={`/admin/documents/${alertePrecedent.id}`}>{alertePrecedent.titre}</Link>, n&apos;a pas été publié :{" "}
              {alertePrecedent.erreur}
            </p>
          )}
          {doc.travail === "GENERER" && (
            <p className="alerte alerte-info">Génération en cours : toute modification des zones annulera la publication automatique (il faudra « Terminer » à nouveau).</p>
          )}
          {doc.erreur && <p className="badge badge-alerte" style={{ whiteSpace: "normal" }}>{doc.erreur}</p>}
          {derniereSupprimee && (
            <p className="petit">
              Zone supprimée ({MOTIF_OCCULTATION[derniereSupprimee.motif]}, page {derniereSupprimee.page} {positionZone(derniereSupprimee)}).{" "}
              <button type="button" className="lien-bouton" onClick={restaurer}>
                Rétablir
              </button>
            </p>
          )}
          <p className="petit" style={{ margin: "0 0 12px" }}>
            {zones.length} zone{zones.length > 1 ? "s" : ""} · <strong>{aVerifier}</strong> à vérifier
          </p>

          <button
            type="button"
            className="bouton bouton-principal bouton-large"
            disabled={occupe || enCours || pages.length === 0 || doc.statut === "NON_PUBLIABLE" || doc.statut === "PUBLIE"}
            onClick={terminer}
          >
            Terminer et passer au suivant
          </button>
          <p className="discret petit" style={{ margin: "6px 0 14px" }}>
            <kbd>Ctrl</kbd> + <kbd>Entrée</kbd> · valide les zones, génère la version occultée et la publie automatiquement.
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
          <ul className="aide-clavier discret petit">
            <li>Tracez un rectangle sur la page pour masquer ; glissez une zone ou ses coins pour l&apos;ajuster.</li>
            <li>
              <kbd>Tab</kbd> / <kbd>Maj</kbd>+<kbd>Tab</kbd> zone à vérifier suivante / précédente
            </li>
            <li>
              <kbd>Entrée</kbd> valider · <kbd>Suppr</kbd> supprimer (puis zone suivante) · <kbd>Ctrl</kbd>+<kbd>Z</kbd> rétablir la dernière zone
              supprimée
            </li>
          </ul>

          {sources.length > 0 && (
            <div className="champ">
              <span>Reprendre les zones manuelles de…</span>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Document source">
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.titre} ({s.nbZones})
                    </option>
                  ))}
                </select>
                <button type="button" className="bouton" onClick={copierZones} disabled={pages.length === 0}>
                  Copier
                </button>
              </div>
              <small className="discret">Pratique pour les documents au même modèle (bons de commande, délibérations…).</small>
            </div>
          )}

          {zoneSel && (
            <div className="zone-panneau">
              <strong className="petit">
                Zone page {zoneSel.page}, {positionZone(zoneSel)} · {zoneSel.source === "AUTO" ? "détectée" : "manuelle"}
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
                  <button type="button" className="bouton bouton-principal" onClick={() => validerEtSuivre(zoneSel.id)}>
                    Valider
                  </button>
                )}
                <button type="button" className="bouton" onClick={() => supprimerEtSuivre(zoneSel.id)}>
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
            <span>Date du document</span>
            <input type="date" value={meta.dateDocument} onChange={(e) => setMeta({ ...meta, dateDocument: e.target.value })} />
          </label>
          <label className="champ">
            <span>Entreprise ou organisme</span>
            <input value={meta.entreprise} onChange={(e) => setMeta({ ...meta, entreprise: e.target.value })} maxLength={200} />
          </label>
          <label className="champ">
            <span>Objet (affiché sur la fiche)</span>
            <textarea rows={2} value={meta.objet} onChange={(e) => setMeta({ ...meta, objet: e.target.value })} />
          </label>
          <div className="grille-champs">
            <label className="champ">
              <span>Montant TTC (€)</span>
              <input inputMode="decimal" value={meta.montantTTC} onChange={(e) => setMeta({ ...meta, montantTTC: e.target.value })} placeholder="Facture : net payé" />
            </label>
            <label className="champ">
              <span>Montant HT (€)</span>
              <input inputMode="decimal" value={meta.montantHT} onChange={(e) => setMeta({ ...meta, montantHT: e.target.value })} />
            </label>
          </div>
          <label className="champ">
            <span>Chantier</span>
            <select value={meta.operationId} onChange={(e) => setMeta({ ...meta, operationId: e.target.value })}>
              <option value="">Aucun</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.intitule}
                </option>
              ))}
            </select>
          </label>
          <label className="case">
            <input type="checkbox" checked={meta.copie} onChange={(e) => setMeta({ ...meta, copie: e.target.checked })} /> Second exemplaire
            (exclu des totaux)
          </label>
          <label className="champ">
            <span>Notes internes</span>
            <textarea rows={3} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
          </label>
          <div className="boutons">
            <button type="submit" className={`bouton${metaModifiee ? " bouton-principal" : ""}`}>
              Enregistrer
            </button>
            {metaModifiee && (
              <span className="petit discret" role="status">
                Modifications non enregistrées (enregistrées automatiquement en changeant de document)
              </span>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}

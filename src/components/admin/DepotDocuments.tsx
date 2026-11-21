"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CategorieDocument } from "@/generated/prisma/enums";
import { CATEGORIES } from "@/lib/admin-schemas";
import { CATEGORIE_DOCUMENT } from "@/lib/statuts";

type Resultat = { fichier: string; statut: "importe" | "doublon" | "ignore" | "erreur"; titre?: string; categorie?: CategorieDocument; message?: string; documentId?: string };
type Envoi = { id: number; fichier: File; etat: "attente" | "envoi" | "fini" | "erreur"; progression: number; resultats: Resultat[]; erreur?: string };

const MAX = 95 * 1024 * 1024; // marge sous la limite de 100 Mo de Cloudflare
const ACCEPTES = ".pdf,.zip,.jpg,.jpeg,.png,.tif,.tiff,.webp,application/pdf,application/zip,image/*";
const LIBELLE_STATUT = { importe: "Importé", doublon: "Doublon", ignore: "Ignoré", erreur: "Erreur" } as const;
const CLASSE_STATUT = { importe: "badge-ok", doublon: "", ignore: "badge-attente", erreur: "badge-alerte" } as const;

const taille = (o: number) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.ceil(o / 1024)} Ko`);

function envoyer(url: string, fichier: File, progression: (p: number) => void): Promise<Resultat[]> {
  return new Promise((ok, ko) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && progression(e.loaded / e.total);
    xhr.onload = () => {
      let corps: { resultats?: Resultat[]; erreur?: string } = {};
      try {
        corps = JSON.parse(xhr.responseText);
      } catch {
        /* réponse non JSON (proxy, Cloudflare…) */
      }
      if (xhr.status >= 200 && xhr.status < 300 && corps.resultats) ok(corps.resultats);
      else ko(new Error(corps.erreur ?? (xhr.status === 401 ? "Session expirée : reconnectez-vous" : `Erreur ${xhr.status}`)));
    };
    xhr.onerror = () => ko(new Error("Connexion interrompue"));
    xhr.send(fichier);
  });
}

export function DepotDocuments({ communes, communeInitiale }: { communes: { code: string; libelle: string }[]; communeInitiale?: string }) {
  const [commune, setCommune] = useState(communeInitiale ?? communes[0]?.code ?? "");
  const [categorie, setCategorie] = useState<CategorieDocument | "">("");
  const [lot, setLot] = useState(() => `Dépôt du ${new Date().toLocaleDateString("fr-FR")}`);
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [survol, setSurvol] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const compteur = useRef(0);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (communeInitiale) return; // arrivée depuis la fiche d'une commune : elle prime
    try {
      const memo = localStorage.getItem("depot-commune");
      if (memo && communes.some((c) => c.code === memo)) setCommune(memo);
    } catch {
      /* stockage indisponible */
    }
  }, [communes, communeInitiale]);

  function choisirCommune(code: string) {
    setCommune(code);
    try {
      localStorage.setItem("depot-commune", code);
    } catch {
      /* stockage indisponible */
    }
  }

  function ajouter(liste: FileList | null) {
    if (!liste) return;
    const nouveaux = [...liste].map<Envoi>((f) => ({
      id: ++compteur.current,
      fichier: f,
      etat: f.size > MAX ? "erreur" : "attente",
      progression: 0,
      resultats: [],
      erreur: f.size > MAX ? "Plus de 95 Mo : découpez l'archive en plusieurs ZIP" : undefined,
    }));
    setEnvois((e) => [...e, ...nouveaux]);
  }

  const maj = (id: number, patch: Partial<Envoi>) => setEnvois((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  async function lancer() {
    setEnCours(true);
    for (const e of envois.filter((x) => x.etat === "attente")) {
      maj(e.id, { etat: "envoi", progression: 0 });
      const params = new URLSearchParams({ commune, nom: e.fichier.name, lot });
      if (categorie) params.set("categorie", categorie);
      try {
        const resultats = await envoyer(`/api/depot?${params}`, e.fichier, (p) => maj(e.id, { progression: p }));
        maj(e.id, { etat: "fini", progression: 1, resultats });
      } catch (err) {
        maj(e.id, { etat: "erreur", erreur: (err as Error).message });
      }
    }
    setEnCours(false);
  }

  const tous = envois.flatMap((e) => e.resultats);
  const nb = (s: Resultat["statut"]) => tous.filter((r) => r.statut === s).length;
  const enAttente = envois.filter((e) => e.etat === "attente").length;

  return (
    <div className="carte">
      <div className="grille-champs">
        <label className="champ">
          <span>Commune</span>
          <select value={commune} onChange={(e) => choisirCommune(e.target.value)} disabled={enCours}>
            {communes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Catégorie</span>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieDocument | "")} disabled={enCours}>
            <option value="">Détection automatique</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_DOCUMENT[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Nom du lot</span>
          <input value={lot} onChange={(e) => setLot(e.target.value)} maxLength={200} disabled={enCours} />
        </label>
      </div>

      <div
        className={`zone-depot${survol ? " zone-depot-survol" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          ajouter(e.dataTransfer.files);
        }}
      >
        <p>
          <strong>Glissez vos fichiers ici</strong>
          <br />
          <span className="discret petit">PDF, images ou ZIP · 95 Mo maximum par fichier</span>
        </p>
        <button type="button" className="bouton" onClick={() => champ.current?.click()} disabled={enCours}>
          Choisir des fichiers
        </button>
        <input
          ref={champ}
          type="file"
          multiple
          accept={ACCEPTES}
          hidden
          onChange={(e) => {
            ajouter(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {envois.length > 0 && (
        <ul className="liste-envois">
          {envois.map((e) => (
            <li key={e.id}>
              <div className="envoi-ligne">
                <span className="envoi-nom">{e.fichier.name}</span>
                <span className="discret petit chiffres">{taille(e.fichier.size)}</span>
                {e.etat === "attente" && (
                  <>
                    <span className="badge">En attente</span>
                    <button type="button" className="lien-bouton petit" onClick={() => setEnvois((es) => es.filter((x) => x.id !== e.id))} disabled={enCours}>
                      Retirer
                    </button>
                  </>
                )}
                {e.etat === "envoi" && (
                  <progress max={1} value={e.progression} aria-label={`Envoi de ${e.fichier.name}`}>
                    {Math.round(e.progression * 100)} %
                  </progress>
                )}
                {e.etat === "fini" && (
                  <span className="badge badge-ok">
                    {e.resultats.filter((r) => r.statut === "importe").length} importé(s)
                  </span>
                )}
                {e.etat === "erreur" && <span className="badge badge-alerte">Échec</span>}
              </div>
              {e.erreur && <p className="petit" style={{ color: "var(--st-alerte-ink)", margin: "4px 0 0" }}>{e.erreur}</p>}
              {e.resultats.length === 1 && e.resultats[0].statut === "importe" && e.resultats[0].documentId && (
                <p className="petit" style={{ margin: "4px 0 0" }}>
                  <Link href={`/admin/documents/${e.resultats[0].documentId}`}>Ouvrir « {e.resultats[0].titre} »</Link> (analyse en cours, quelques secondes par page)
                </p>
              )}
              {e.resultats.length > 1 || (e.resultats.length === 1 && e.resultats[0].statut !== "importe") ? (
                <details className="donnees" open={e.resultats.some((r) => r.statut !== "importe" && r.statut !== "doublon")}>
                  <summary>Détail des {e.resultats.length} fichier(s)</summary>
                  <ul className="detail-import">
                    {e.resultats.map((r, i) => (
                      <li key={i}>
                        <span className={`badge ${CLASSE_STATUT[r.statut]}`}>{LIBELLE_STATUT[r.statut]}</span>{" "}
                        {r.documentId ? <Link href={`/admin/documents/${r.documentId}`}>{r.titre}</Link> : <span>{r.fichier}</span>}
                        {r.categorie && <span className="discret petit"> · {CATEGORIE_DOCUMENT[r.categorie]}</span>}
                        {r.message && <span className="discret petit"> · {r.message}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="boutons" style={{ marginTop: 16, alignItems: "center" }}>
        <button type="button" className="bouton bouton-principal" onClick={lancer} disabled={enCours || enAttente === 0}>
          {enCours ? "Envoi en cours…" : enAttente === 0 ? "Choisissez des fichiers" : `Envoyer ${enAttente} fichier${enAttente > 1 ? "s" : ""}`}
        </button>
        {tous.length > 0 && !enCours && (
          <span className="petit">
            {nb("importe")} importé(s) · {nb("doublon")} doublon(s) · {nb("ignore")} ignoré(s)
            {nb("erreur") ? ` · ${nb("erreur")} erreur(s)` : ""} — <Link href="/admin/documents?statut=A_VERIFIER">documents à vérifier</Link>
          </span>
        )}
      </div>
    </div>
  );
}

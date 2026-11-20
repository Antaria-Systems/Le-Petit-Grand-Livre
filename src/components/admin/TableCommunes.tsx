"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEntier } from "@/lib/format";
import { STATUT_DEMANDE } from "@/lib/statuts";
import { normaliser } from "@/lib/texte";

export type LigneCommune = {
  code: string;
  nom: string;
  population: number | null;
  email: boolean;
  publies: number;
  aTraiter: number;
  chantiers: number;
  demande: { statut: keyof typeof STATUT_DEMANDE; annee: number } | null;
};

type Filtre = "toutes" | "documents" | "demandes" | "sans-demande";

export function TableCommunes({ communes }: { communes: LigneCommune[] }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const lignes = useMemo(() => {
    const n = normaliser(q);
    return communes
      .filter((c) => !n || normaliser(c.nom).includes(n) || c.code.startsWith(n))
      .filter((c) =>
        filtre === "documents" ? c.publies + c.aTraiter > 0 : filtre === "demandes" ? c.demande !== null : filtre === "sans-demande" ? c.demande === null : true,
      );
  }, [communes, q, filtre]);

  return (
    <>
      <div className="bibliotheque-recherche">
        <input type="search" placeholder="Rechercher une commune…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une commune" />
        <select value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)} aria-label="Filtrer">
          <option value="toutes">Toutes les communes</option>
          <option value="documents">Avec des documents</option>
          <option value="demandes">Avec une demande</option>
          <option value="sans-demande">Sans demande</option>
        </select>
        <span className="discret petit" style={{ alignSelf: "center" }}>
          {lignes.length} commune{lignes.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="carte tableau-defilant">
        <table>
          <thead>
            <tr>
              <th>Commune</th>
              <th className="nombre">Population</th>
              <th className="nombre">Publiés</th>
              <th className="nombre">À traiter</th>
              <th className="nombre">Chantiers</th>
              <th>Dernière demande</th>
              <th>Courriel mairie</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((c) => (
              <tr key={c.code}>
                <td>
                  <Link href={`/admin/communes/${c.code}`}>{c.nom}</Link> <span className="discret petit">{c.code}</span>
                </td>
                <td className="nombre">{c.population !== null ? formatEntier(c.population) : "—"}</td>
                <td className="nombre">{c.publies || "—"}</td>
                <td className="nombre">{c.aTraiter ? <span className="badge badge-alerte">{c.aTraiter}</span> : "—"}</td>
                <td className="nombre">{c.chantiers || "—"}</td>
                <td>
                  {c.demande ? (
                    <span className={`badge ${STATUT_DEMANDE[c.demande.statut].classe}`}>
                      {c.demande.annee} · {STATUT_DEMANDE[c.demande.statut].libelle}
                    </span>
                  ) : (
                    <span className="discret">—</span>
                  )}
                </td>
                <td>{c.email ? "Oui" : <span className="badge badge-attente">Manquant</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

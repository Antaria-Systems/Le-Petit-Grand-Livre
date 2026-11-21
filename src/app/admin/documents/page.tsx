import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import type { StatutDocument } from "@/generated/prisma/enums";
import { verifierAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatDateCourte } from "@/lib/format";
import { depuisHeureParis, versHeureParis } from "@/lib/heure";
import { CATEGORIE_DOCUMENT, STATUT_DOCUMENT } from "@/lib/statuts";
import { normaliser } from "@/lib/texte";

type Props = { searchParams: Promise<{ statut?: string; bloques?: string; publies?: string; q?: string; commune?: string; lot?: string; page?: string }> };

const ORDRE: StatutDocument[] = ["A_VERIFIER", "RECU", "EN_ANALYSE", "OCCULTE", "PUBLIE", "NON_PUBLIABLE"];
const PAR_PAGE = 50;

export default async function AdminDocuments({ searchParams }: Props) {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const p = await searchParams;
  const filtre = ORDRE.includes(p.statut as StatutDocument) ? (p.statut as StatutDocument) : undefined;
  const bloques = p.bloques === "1";
  // « Publiés aujourd'hui » : relecture d'un coup d'œil des publications automatiques de « Terminer »
  const publiesJour = p.publies === "jour";
  const minuitParis = depuisHeureParis(`${versHeureParis(new Date()).slice(0, 10)}T00:00`)!;
  const q = (p.q ?? "").trim().slice(0, 100);
  const commune = /^[0-9AB]{5}$/.test(p.commune ?? "") ? p.commune : undefined;
  const lot = (p.lot ?? "").slice(0, 200) || undefined;
  const page = Math.max(1, Number(p.page) || 1);

  const where: Prisma.DocumentWhereInput = {
    ...(bloques
      ? { statut: "OCCULTE", erreur: { not: null }, travail: null }
      : publiesJour
        ? { statut: "PUBLIE", publieLe: { gte: minuitParis } }
        : filtre
          ? { statut: filtre }
          : {}),
    ...(commune ? { communeCode: commune } : {}),
    ...(lot ? { lot } : {}),
    ...(q
      ? {
          OR: [
            { titre: { contains: q, mode: "insensitive" } },
            { entreprise: { contains: q, mode: "insensitive" } },
            { commune: { nomRecherche: { contains: normaliser(q) } } },
          ],
        }
      : {}),
  };

  const [compteurs, nbBloques, total, documents, lots, communes] = await Promise.all([
    db.document.groupBy({ by: ["statut"], _count: true }),
    db.document.count({ where: { statut: "OCCULTE", erreur: { not: null }, travail: null } }),
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: [{ recuLe: "desc" }, { titre: "asc" }],
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
      select: {
        id: true,
        titre: true,
        categorie: true,
        annee: true,
        nbPages: true,
        statut: true,
        travail: true,
        erreur: true,
        recuLe: true,
        lot: true,
        commune: { select: { nom: true, code: true } },
        _count: { select: { zones: true } },
        zones: { where: { validee: false }, select: { id: true } },
      },
    }),
    db.document.groupBy({ by: ["lot"], where: { lot: { not: null } }, _count: true, orderBy: { lot: "asc" } }),
    db.commune.findMany({ where: { documents: { some: {} } }, select: { code: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  const tous = compteurs.reduce((s, c) => s + c._count, 0);
  const nb = (s: StatutDocument) => compteurs.find((c) => c.statut === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const lien = (changes: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const base = { statut: filtre, bloques: bloques ? "1" : undefined, publies: publiesJour ? "jour" : undefined, q: q || undefined, commune, lot, ...changes };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/documents${s ? `?${s}` : ""}`;
  };

  return (
    <section className="section">
      <div className="conteneur">
        <div className="bloc-titre">
          <h1 style={{ margin: 0 }}>Documents</h1>
          <Link href="/admin/depot" className="bouton bouton-principal">
            Déposer des documents
          </Link>
        </div>
        <nav className="selecteur-annee" aria-label="Filtrer par statut" style={{ marginBottom: 12 }}>
          <Link href={lien({ statut: undefined, bloques: undefined, publies: undefined, page: undefined })} aria-current={!filtre && !bloques && !publiesJour ? "page" : undefined}>
            Tous ({tous})
          </Link>
          <Link href={lien({ statut: undefined, bloques: undefined, publies: "jour", page: undefined })} aria-current={publiesJour ? "page" : undefined}>
            Publiés aujourd&apos;hui
          </Link>
          {nbBloques > 0 && (
            <Link href={lien({ statut: undefined, bloques: "1", publies: undefined, page: undefined })} aria-current={bloques ? "page" : undefined}>
              Bloqués par le contrôle ({nbBloques})
            </Link>
          )}
          {ORDRE.filter((s) => nb(s) > 0).map((s) => (
            <Link key={s} href={lien({ statut: s, bloques: undefined, publies: undefined, page: undefined })} aria-current={filtre === s && !bloques ? "page" : undefined}>
              {STATUT_DOCUMENT[s].libelle} ({nb(s)})
            </Link>
          ))}
        </nav>
        <form className="filtres-admin" action="/admin/documents" role="search">
          {filtre && <input type="hidden" name="statut" value={filtre} />}
          {bloques && <input type="hidden" name="bloques" value="1" />}
          <label className="champ">
            <span>Rechercher (titre, entreprise, commune)</span>
            <input name="q" type="search" defaultValue={q} />
          </label>
          <label className="champ">
            <span>Commune</span>
            <select name="commune" defaultValue={commune ?? ""}>
              <option value="">Toutes</option>
              {communes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          {lots.length > 0 && (
            <label className="champ">
              <span>Lot d&apos;import</span>
              <select name="lot" defaultValue={lot ?? ""}>
                <option value="">Tous</option>
                {lots.map((l) => (
                  <option key={l.lot} value={l.lot!}>
                    {l.lot} ({l._count})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="bouton">
            Filtrer
          </button>
        </form>
        <p className="petit discret" aria-live="polite">
          {total} document{total > 1 ? "s" : ""} · les plus récemment reçus d&apos;abord
        </p>
        {documents.length === 0 ? (
          <div className="vide">
            <strong>Aucun document ne correspond.</strong> <Link href="/admin/documents">Effacer les filtres</Link>
          </div>
        ) : (
          <div className="carte tableau-defilant">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Catégorie</th>
                  <th>Reçu le</th>
                  <th className="nombre">Pages</th>
                  <th className="nombre">Zones</th>
                  <th className="nombre">À vérifier</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => {
                  const bloque = d.statut === "OCCULTE" && !!d.erreur && !d.travail;
                  return (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/admin/documents/${d.id}`}>{d.titre}</Link>
                        <div className="discret petit">
                          <Link href={lien({ commune: d.commune.code, page: undefined })}>{d.commune.nom}</Link>
                          {d.annee ? ` · ${d.annee}` : ""}
                          {d.lot ? ` · lot « ${d.lot} »` : ""}
                        </div>
                        {d.erreur && (
                          <div className="badge badge-alerte" style={{ whiteSpace: "normal" }}>
                            {bloque ? "" : "Erreur : "}
                            {d.erreur}
                          </div>
                        )}
                      </td>
                      <td>{CATEGORIE_DOCUMENT[d.categorie]}</td>
                      <td className="chiffres">{formatDateCourte(d.recuLe)}</td>
                      <td className="nombre">{d.nbPages ?? "—"}</td>
                      <td className="nombre">{d._count.zones}</td>
                      <td className="nombre">{d.zones.length || "—"}</td>
                      <td>
                        {bloque ? (
                          <span className="badge badge-alerte">Bloqué : coordonnée lisible</span>
                        ) : (
                          <span className={`badge ${STATUT_DOCUMENT[d.statut].classe}`}>{STATUT_DOCUMENT[d.statut].libelle}</span>
                        )}
                        {d.travail && <div className="discret petit">{d.travail === "ANALYSER" ? "analyse en attente" : "génération en attente"}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav className="pagination" aria-label="Pages">
            {page > 1 && <Link href={lien({ page: String(page - 1) })}>← Précédents</Link>}
            <span className="discret">
              Page {page} sur {pages}
            </span>
            {page < pages && <Link href={lien({ page: String(page + 1) })}>Suivants →</Link>}
          </nav>
        )}
      </div>
    </section>
  );
}

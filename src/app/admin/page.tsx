import Link from "next/link";
import type { StatutDocument } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { CATEGORIE_DOCUMENT, STATUT_DOCUMENT } from "@/lib/statuts";

type Props = { searchParams: Promise<{ statut?: string }> };

const ORDRE: StatutDocument[] = ["A_VERIFIER", "RECU", "EN_ANALYSE", "OCCULTE", "PUBLIE", "NON_PUBLIABLE"];

export default async function AdminDocuments({ searchParams }: Props) {
  const { statut } = await searchParams;
  const filtre = ORDRE.includes(statut as StatutDocument) ? (statut as StatutDocument) : undefined;

  const [compteurs, documents] = await Promise.all([
    db.document.groupBy({ by: ["statut"], _count: true }),
    db.document.findMany({
      where: filtre ? { statut: filtre } : {},
      orderBy: [{ categorie: "asc" }, { titre: "asc" }],
      select: {
        id: true,
        titre: true,
        categorie: true,
        annee: true,
        nbPages: true,
        statut: true,
        travail: true,
        erreur: true,
        commune: { select: { nom: true } },
        _count: { select: { zones: true } },
        zones: { where: { validee: false }, select: { id: true } },
      },
    }),
  ]);
  const total = compteurs.reduce((s, c) => s + c._count, 0);
  const nb = (s: StatutDocument) => compteurs.find((c) => c.statut === s)?._count ?? 0;

  return (
    <section className="section">
      <div className="conteneur">
        <div className="bloc-titre">
          <h1 style={{ margin: 0 }}>Documents</h1>
          <Link href="/admin/depot" className="bouton bouton-principal">
            Déposer des documents
          </Link>
        </div>
        <nav className="selecteur-annee" aria-label="Filtrer par statut" style={{ marginBottom: 20 }}>
          <Link href="/admin" aria-current={!filtre ? "page" : undefined}>
            Tous ({total})
          </Link>
          {ORDRE.filter((s) => nb(s) > 0).map((s) => (
            <Link key={s} href={`/admin?statut=${s}`} aria-current={filtre === s ? "page" : undefined}>
              {STATUT_DOCUMENT[s].libelle} ({nb(s)})
            </Link>
          ))}
        </nav>
        <div className="carte tableau-defilant">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Catégorie</th>
                <th className="nombre">Pages</th>
                <th className="nombre">Zones</th>
                <th className="nombre">À vérifier</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/admin/documents/${d.id}`}>{d.titre}</Link>
                    <div className="discret petit">
                      {d.commune.nom}
                      {d.annee ? ` · ${d.annee}` : ""}
                    </div>
                    {d.erreur && <div className="badge badge-alerte" style={{ whiteSpace: "normal" }}>Erreur : {d.erreur}</div>}
                  </td>
                  <td>{CATEGORIE_DOCUMENT[d.categorie]}</td>
                  <td className="nombre">{d.nbPages ?? "—"}</td>
                  <td className="nombre">{d._count.zones}</td>
                  <td className="nombre">{d.zones.length || "—"}</td>
                  <td>
                    <span className={`badge ${STATUT_DOCUMENT[d.statut].classe}`}>{STATUT_DOCUMENT[d.statut].libelle}</span>
                    {d.travail && <div className="discret petit">{d.travail === "ANALYSER" ? "analyse en attente" : "génération en attente"}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

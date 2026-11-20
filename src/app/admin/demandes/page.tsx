import Link from "next/link";
import { db } from "@/lib/db";
import { situationDemande } from "@/lib/demande";
import { formatDateCourte } from "@/lib/format";
import { STATUT_DEMANDE } from "@/lib/statuts";

type Props = { searchParams: Promise<{ statut?: string }> };

export default async function AdminDemandes({ searchParams }: Props) {
  const { statut } = await searchParams;
  const filtre = statut && statut in STATUT_DEMANDE ? (statut as keyof typeof STATUT_DEMANDE) : undefined;
  const [demandes, compteurs] = await Promise.all([
    db.demande.findMany({
      where: filtre ? { statut: filtre } : {},
      include: { commune: { select: { nom: true, code: true, departementCode: true } }, _count: { select: { documents: true } } },
      orderBy: [{ annee: "desc" }, { envoyeeLe: "desc" }],
    }),
    db.demande.groupBy({ by: ["statut"], _count: true }),
  ]);
  const total = compteurs.reduce((s, c) => s + c._count, 0);

  return (
    <section className="section">
      <div className="conteneur">
        <h1>Demandes CRPA / CADA</h1>
        <p className="discret">
          Pour créer une demande, ouvrez une commune depuis les <Link href="/admin/regions">territoires</Link>, onglet « Demandes ».
        </p>
        <nav className="selecteur-annee" aria-label="Filtrer par statut" style={{ marginBottom: 20 }}>
          <Link href="/admin/demandes" aria-current={!filtre ? "page" : undefined}>
            Toutes ({total})
          </Link>
          {compteurs.map((c) => (
            <Link key={c.statut} href={`/admin/demandes?statut=${c.statut}`} aria-current={filtre === c.statut ? "page" : undefined}>
              {STATUT_DEMANDE[c.statut].libelle} ({c._count})
            </Link>
          ))}
        </nav>
        {demandes.length === 0 ? (
          <div className="vide">
            <strong>Aucune demande{filtre ? " avec ce statut" : ""}.</strong>
          </div>
        ) : (
          <div className="carte tableau-defilant">
            <table>
              <thead>
                <tr>
                  <th>Commune</th>
                  <th>Année</th>
                  <th>Statut</th>
                  <th>Envoyée</th>
                  <th>Réponse attendue</th>
                  <th>CADA avant</th>
                  <th className="nombre">Documents</th>
                  <th>À faire</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => {
                  const a = situationDemande(d);
                  return (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/admin/communes/${d.commune.code}?onglet=demandes`}>{d.commune.nom}</Link>{" "}
                        <span className="discret petit">({d.commune.departementCode})</span>
                      </td>
                      <td className="chiffres">{d.annee}</td>
                      <td>
                        <span className={`badge ${STATUT_DEMANDE[d.statut].classe}`}>{STATUT_DEMANDE[d.statut].libelle}</span>
                      </td>
                      <td className="chiffres">{d.envoyeeLe ? formatDateCourte(d.envoyeeLe) : "—"}</td>
                      <td className="chiffres">{d.echeanceReponse ? formatDateCourte(d.echeanceReponse) : "—"}</td>
                      <td className="chiffres">{d.limiteSaisineCada ? formatDateCourte(d.limiteSaisineCada) : "—"}</td>
                      <td className="nombre">{d._count.documents || "—"}</td>
                      <td className="petit">{a ? <span className={`alerte alerte-${a.niveau}`}>{a.texte}</span> : d.statut === "BROUILLON" ? "Relire et envoyer" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

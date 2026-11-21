import Link from "next/link";
import { notFound } from "next/navigation";
import { activerDepartement, desactiverDepartement } from "@/app/admin/actions";
import { FormulaireAction } from "@/components/admin/FormulaireAction";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";
import { verifierAdminPage } from "@/lib/admin";

export default async function AdminRegion({ params }: { params: Promise<{ code: string }> }) {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const { code } = await params;
  const region = await db.region.findUnique({
    where: { code },
    include: { departements: { orderBy: { code: "asc" }, include: { _count: { select: { communes: true } } } } },
  });
  if (!region) notFound();
  const codes = region.departements.map((d) => d.code);
  const [taches, docs] = await Promise.all([
    db.tache.findMany({ where: { type: "IMPORTER_DEPARTEMENT", parametre: { in: codes } }, orderBy: { creeLe: "desc" } }),
    db.document.findMany({ where: { statut: "PUBLIE", commune: { departementCode: { in: codes } } }, select: { commune: { select: { departementCode: true } } } }),
  ]);

  return (
    <section className="section">
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin/regions">Territoires</Link> › {region.nom}
        </p>
        <h1>{region.nom}</h1>
        <div className="carte tableau-defilant">
          <table>
            <thead>
              <tr>
                <th>Département</th>
                <th>Couverture</th>
                <th className="nombre">Communes</th>
                <th className="nombre">Documents publiés</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {region.departements.map((d) => {
                const tache = taches.find((t) => t.parametre === d.code);
                const enCours = tache && (tache.statut === "EN_ATTENTE" || tache.statut === "EN_COURS");
                return (
                  <tr key={d.code}>
                    <td>
                      {d.actif ? <Link href={`/admin/departements/${d.code}`}>{d.nom}</Link> : d.nom} <span className="discret">({d.code})</span>
                      {tache && (
                        <details className="journal-tache">
                          <summary className="petit discret">
                            Dernier import : {tache.statut === "TERMINEE" ? "terminé" : tache.statut === "ERREUR" ? "en erreur" : enCours ? "en cours…" : ""}
                          </summary>
                          <pre>{tache.journal || "En attente du worker…"}</pre>
                        </details>
                      )}
                    </td>
                    <td>{d.actif ? <span className="badge badge-ok">Couvert</span> : <span className="badge">Non couvert</span>}</td>
                    <td className="nombre">{d._count.communes ? formatEntier(d._count.communes) : "—"}</td>
                    <td className="nombre">{docs.filter((x) => x.commune.departementCode === d.code).length || "—"}</td>
                    <td>
                      {enCours ? (
                        <span className="badge badge-attente">Import en cours</span>
                      ) : d.actif ? (
                        <FormulaireAction action={desactiverDepartement} confirmation={`Ne plus afficher ${d.nom} comme couvert ? Les données sont conservées.`}>
                          <input type="hidden" name="code" value={d.code} />
                          <button type="submit" className="bouton petit-bouton">
                            Retirer
                          </button>
                        </FormulaireAction>
                      ) : (
                        <FormulaireAction action={activerDepartement} confirmation={`Couvrir ${d.nom} ? Ses communes, ses comptes et les coordonnées des mairies seront importés.`}>
                          <input type="hidden" name="code" value={d.code} />
                          <button type="submit" className="bouton bouton-principal petit-bouton">
                            Couvrir et importer
                          </button>
                        </FormulaireAction>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

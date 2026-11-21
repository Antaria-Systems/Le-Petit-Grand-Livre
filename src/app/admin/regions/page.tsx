import Link from "next/link";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";
import { verifierAdminPage } from "@/lib/admin";

export default async function AdminRegions() {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const regions = await db.region.findMany({
    orderBy: { nom: "asc" },
    include: { departements: { select: { actif: true, _count: { select: { communes: true } } } } },
  });
  const docs = await db.document.groupBy({ by: ["communeCode"], where: { statut: "PUBLIE" }, _count: true });
  const communesAvecDocs = new Set(docs.map((d) => d.communeCode));
  const parRegion = await db.commune.findMany({ where: { code: { in: [...communesAvecDocs] } }, select: { code: true, departement: { select: { regionCode: true } } } });

  return (
    <section className="section">
      <div className="conteneur">
        <p className="petit discret">Territoires</p>
        <h1>Régions</h1>
        <div className="carte tableau-defilant">
          <table>
            <thead>
              <tr>
                <th>Région</th>
                <th className="nombre">Départements</th>
                <th className="nombre">Couverts</th>
                <th className="nombre">Communes importées</th>
                <th className="nombre">Communes avec documents</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => {
                const couverts = r.departements.filter((d) => d.actif).length;
                return (
                  <tr key={r.code}>
                    <td>
                      <Link href={`/admin/regions/${r.code}`}>{r.nom}</Link>
                    </td>
                    <td className="nombre">{r.departements.length}</td>
                    <td className="nombre">{couverts ? <span className="badge badge-accent">{couverts}</span> : "—"}</td>
                    <td className="nombre">{formatEntier(r.departements.reduce((s, d) => s + d._count.communes, 0)) || "—"}</td>
                    <td className="nombre">{parRegion.filter((c) => c.departement.regionCode === r.code).length || "—"}</td>
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

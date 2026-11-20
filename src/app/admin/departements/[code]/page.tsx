import Link from "next/link";
import { notFound } from "next/navigation";
import { TableCommunes, type LigneCommune } from "@/components/admin/TableCommunes";
import { statsCommunes } from "@/lib/admin-stats";
import { db } from "@/lib/db";
import type { STATUT_DEMANDE } from "@/lib/statuts";

export default async function AdminDepartement({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const dep = await db.departement.findUnique({
    where: { code },
    include: { region: true, communes: { orderBy: { nomRecherche: "asc" }, select: { code: true, nom: true, population: true, mairieEmail: true } } },
  });
  if (!dep) notFound();
  const stats = await statsCommunes(dep.communes.map((c) => c.code));
  const lignes: LigneCommune[] = dep.communes
    .map((c) => {
      const s = stats.get(c.code);
      return {
        code: c.code,
        nom: c.nom,
        population: c.population,
        email: Boolean(c.mairieEmail),
        publies: s?.publies ?? 0,
        aTraiter: s?.aTraiter ?? 0,
        chantiers: s?.chantiers ?? 0,
        demande: s?.derniereDemande ? { statut: s.derniereDemande.statut as keyof typeof STATUT_DEMANDE, annee: s.derniereDemande.annee } : null,
      };
    })
    // Les communes actives (documents, demandes) d'abord
    .sort((a, b) => b.publies + b.aTraiter + (b.demande ? 1 : 0) - (a.publies + a.aTraiter + (a.demande ? 1 : 0)) || a.nom.localeCompare(b.nom, "fr"));

  return (
    <section className="section">
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin/regions">Territoires</Link> › <Link href={`/admin/regions/${dep.region.code}`}>{dep.region.nom}</Link> › {dep.nom}
        </p>
        <div className="bloc-titre">
          <h1 style={{ margin: 0 }}>
            {dep.nom} <span className="discret">({dep.code})</span>
          </h1>
          <Link href={`/departements/${dep.code}`} className="bouton">
            Page publique
          </Link>
        </div>
        {dep.communes.length === 0 ? (
          <div className="vide">
            <strong>Aucune commune importée.</strong> Couvrez ce département depuis la page de sa{" "}
            <Link href={`/admin/regions/${dep.region.code}`}>région</Link>.
          </div>
        ) : (
          <TableCommunes communes={lignes} />
        )}
      </div>
    </section>
  );
}

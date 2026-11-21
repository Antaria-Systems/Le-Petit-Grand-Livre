import { DepotDocuments } from "@/components/admin/DepotDocuments";
import { db } from "@/lib/db";
import { verifierAdminPage } from "@/lib/admin";

export default async function PageDepot({ searchParams }: { searchParams: Promise<{ commune?: string }> }) {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const { commune: communeDemandee } = await searchParams;
  const communes = await db.commune.findMany({
    where: { departement: { actif: true } },
    orderBy: { nomRecherche: "asc" },
    select: { code: true, nom: true, departementCode: true },
  });
  return (
    <section className="section">
      <div className="conteneur" style={{ maxWidth: 860 }}>
        <h1>Déposer des documents</h1>
        <p className="discret">
          PDF, scans et photos (JPEG, PNG, TIFF) ou archives ZIP, même avec des sous-dossiers. Tout est chiffré à
          l&apos;arrivée, dédoublonné, classé d&apos;après les noms de dossiers et de fichiers, puis analysé. Rien n&apos;est
          publié sans votre validation.
        </p>
        <DepotDocuments
          communes={communes.map((c) => ({ code: c.code, libelle: `${c.nom} (${c.departementCode})` }))}
          communeInitiale={communes.some((c) => c.code === communeDemandee) ? communeDemandee : undefined}
        />
      </div>
    </section>
  );
}

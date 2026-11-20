import Link from "next/link";
import { notFound } from "next/navigation";
import { EditeurOccultation } from "@/components/admin/EditeurOccultation";
import { db } from "@/lib/db";

export default async function AdminDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      commune: { select: { nom: true, slug: true } },
      pages: { orderBy: { numero: "asc" }, select: { numero: true, largeur: true, hauteur: true } },
      zones: { orderBy: [{ page: "asc" }, { y: "asc" }] },
    },
  });
  if (!doc) notFound();

  return (
    <section className="section" style={{ paddingTop: 20 }}>
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin">← Tous les documents</Link> · <Link href={`/communes/${doc.commune.slug}#documents`}>{doc.commune.nom}</Link>
        </p>
        <EditeurOccultation
          document={{
            id: doc.id,
            titre: doc.titre,
            categorie: doc.categorie,
            annee: doc.annee,
            notes: doc.notes,
            statut: doc.statut,
            travail: doc.travail,
            erreur: doc.erreur,
            nomOriginal: doc.nomOriginal,
            aVersionPublique: !!doc.cheminPublic,
          }}
          pages={doc.pages}
          zonesInitiales={doc.zones.map((z) => ({
            id: z.id,
            page: z.page,
            x: z.x,
            y: z.y,
            largeur: z.largeur,
            hauteur: z.hauteur,
            motif: z.motif,
            source: z.source,
            validee: z.validee,
          }))}
        />
      </div>
    </section>
  );
}

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

  // File de vérification : même ordre que la liste de l'admin (catégorie, puis titre).
  const file = await db.document.findMany({
    where: { statut: "A_VERIFIER", OR: [{ travail: null }, { id }] },
    orderBy: [{ categorie: "asc" }, { titre: "asc" }],
    select: { id: true },
  });
  const ids = file.map((d) => d.id);
  const i = ids.indexOf(id);
  const autres = ids.filter((x) => x !== id);
  const navigation = {
    position: i >= 0 ? i + 1 : null,
    total: ids.length,
    suivantId: autres.length ? (i >= 0 ? ids[(i + 1) % ids.length] : ids[0]) : null,
    precedentId: autres.length ? (i >= 0 ? ids[(i - 1 + ids.length) % ids.length] : ids[ids.length - 1]) : null,
  };
  if (navigation.suivantId === id) navigation.suivantId = null;
  if (navigation.precedentId === id) navigation.precedentId = null;

  const chantiers = await db.operation.findMany({ where: { communeCode: doc.communeCode }, orderBy: { intitule: "asc" }, select: { id: true, intitule: true } });

  // Documents de la même commune dont on peut reprendre les zones tracées à la main (récents d'abord).
  const candidats = await db.document.findMany({
    where: { communeCode: doc.communeCode, id: { not: id }, zones: { some: { source: "MANUEL" } } },
    select: {
      id: true,
      titre: true,
      categorie: true,
      zones: { where: { source: "MANUEL" }, select: { creeeLe: true } },
    },
  });
  const sources = candidats
    .map((c) => ({
      id: c.id,
      titre: c.titre,
      nbZones: c.zones.length,
      memeType: c.categorie === doc.categorie,
      recent: Math.max(...c.zones.map((z) => z.creeeLe.getTime())),
    }))
    .sort((a, b) => Number(b.memeType) - Number(a.memeType) || b.recent - a.recent)
    .slice(0, 20)
    .map(({ id, titre, nbZones }) => ({ id, titre, nbZones }));

  return (
    <section className="section" style={{ paddingTop: 20 }}>
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin">← Tous les documents</Link> · <Link href={`/communes/${doc.commune.slug}#documents`}>{doc.commune.nom}</Link>
        </p>
        <EditeurOccultation
          key={doc.id}
          navigation={navigation}
          sources={sources}
          chantiers={chantiers}
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
            entreprise: doc.entreprise,
            objet: doc.objet,
            montantTTC: doc.montantTTC === null ? null : Number(doc.montantTTC),
            montantHT: doc.montantHT === null ? null : Number(doc.montantHT),
            dateDocument: doc.dateDocument ? doc.dateDocument.toISOString().slice(0, 10) : null,
            copie: doc.copie,
            operationId: doc.operationId,
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

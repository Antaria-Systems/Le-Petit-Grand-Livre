import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { invaliderVersionPublique } from "@/lib/admin-documents";
import { db } from "@/lib/db";

const schema = z.object({ depuis: z.string().min(1).max(64) });

/**
 * Reprend les zones tracées à la main sur un autre document (même modèle : bons de commande,
 * délibérations…). Elles arrivent comme PROPOSITIONS à vérifier, car la mise en page peut varier.
 * La dernière page de la source correspond à la dernière page de la cible (signatures).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json());
  if (!donnees.success) return Response.json({ erreur: "Document source manquant" }, { status: 400 });

  const [cible, source] = await Promise.all([
    db.document.findUnique({ where: { id }, select: { nbPages: true } }),
    db.document.findUnique({ where: { id: donnees.data.depuis }, select: { nbPages: true, zones: { where: { source: "MANUEL" } } } }),
  ]);
  if (!cible?.nbPages || !source?.nbPages) return Response.json({ erreur: "Document introuvable ou pas encore analysé" }, { status: 404 });

  const page = (p: number) => (p === source.nbPages ? cible.nbPages! : p <= cible.nbPages! ? p : null);
  const data = source.zones
    .map((z) => ({ page: page(z.page), x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur, motif: z.motif }))
    .filter((z): z is typeof z & { page: number } => z.page !== null)
    .map((z) => ({ ...z, documentId: id, source: "MANUEL" as const, validee: false }));
  if (data.length === 0) return Response.json({ erreur: "Aucune zone à reprendre" }, { status: 409 });

  const zones = await db.zoneOccultation.createManyAndReturn({ data });
  await invaliderVersionPublique(id);
  return Response.json({ zones });
}

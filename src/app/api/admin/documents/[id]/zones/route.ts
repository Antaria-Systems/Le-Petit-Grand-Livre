import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { invaliderVersionPublique } from "@/lib/admin-documents";
import { MOTIFS, schemaRect } from "@/lib/admin-schemas";

const schema = schemaRect.extend({ page: z.number().int().min(1), motif: z.enum(MOTIFS) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json().catch(() => null));
  if (!donnees.success) return Response.json({ erreur: donnees.error.message }, { status: 400 });
  const doc = await db.document.findUnique({ where: { id }, select: { nbPages: true } });
  if (!doc) return Response.json({ erreur: "Document introuvable" }, { status: 404 });
  if (doc.nbPages && donnees.data.page > doc.nbPages) return Response.json({ erreur: "Page hors du document" }, { status: 400 });
  const zone = await db.zoneOccultation.create({ data: { ...donnees.data, documentId: id, source: "MANUEL", validee: true } });
  await invaliderVersionPublique(id);
  return Response.json(zone);
}

import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { MOTIFS, schemaRect } from "@/lib/admin-schemas";
import { db } from "@/lib/db";
import { invaliderVersionPublique } from "@/lib/admin-documents";

const schema = schemaRect.partial().extend({ motif: z.enum(MOTIFS).optional(), validee: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { zoneId } = await params;
  const donnees = schema.safeParse(await req.json().catch(() => null));
  if (!donnees.success) return Response.json({ erreur: donnees.error.message }, { status: 400 });
  const existe = await db.zoneOccultation.findUnique({ where: { id: zoneId }, select: { id: true } });
  if (!existe) return Response.json({ erreur: "Zone introuvable (déjà supprimée ?)" }, { status: 404 });
  const zone = await db.zoneOccultation.update({ where: { id: zoneId }, data: donnees.data });
  await invaliderVersionPublique(zone.documentId);
  return Response.json(zone);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { zoneId } = await params;
  const zone = await db.zoneOccultation.findUnique({ where: { id: zoneId }, select: { documentId: true } });
  if (!zone) return Response.json({ ok: true }); // déjà supprimée
  await db.zoneOccultation.delete({ where: { id: zoneId } });
  await invaliderVersionPublique(zone.documentId);
  return Response.json({ ok: true });
}

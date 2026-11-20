import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { CATEGORIES } from "@/lib/admin-schemas";
import { db } from "@/lib/db";

const schema = z.object({
  titre: z.string().trim().min(1).max(200).optional(),
  categorie: z.enum(CATEGORIES).optional(),
  annee: z.number().int().min(1990).max(2100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json());
  if (!donnees.success) return Response.json({ erreur: donnees.error.message }, { status: 400 });
  const doc = await db.document.update({ where: { id }, data: donnees.data });
  return Response.json({ ok: true, titre: doc.titre });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, select: { statut: true, travail: true, erreur: true, cheminPublic: true } });
  if (!doc) return Response.json({ erreur: "Introuvable" }, { status: 404 });
  return Response.json({ statut: doc.statut, travail: doc.travail, erreur: doc.erreur, aVersionPublique: !!doc.cheminPublic });
}

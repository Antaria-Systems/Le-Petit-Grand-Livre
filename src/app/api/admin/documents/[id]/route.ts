import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { CATEGORIES } from "@/lib/admin-schemas";
import { db } from "@/lib/db";

const schema = z.object({
  titre: z.string().trim().min(1).max(200).optional(),
  categorie: z.enum(CATEGORIES).optional(),
  annee: z.number().int().min(1990).max(2100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  entreprise: z.string().trim().max(200).nullable().optional(),
  objet: z.string().trim().max(2000).nullable().optional(),
  montantTTC: z.number().nonnegative().max(1e9).nullable().optional(),
  montantHT: z.number().nonnegative().max(1e9).nullable().optional(),
  dateDocument: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  copie: z.boolean().optional(),
  operationId: z.number().int().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json().catch(() => null));
  if (!donnees.success) return Response.json({ erreur: donnees.error.message }, { status: 400 });
  const { dateDocument, operationId, ...reste } = donnees.data;
  if (operationId) {
    const [doc, op] = await Promise.all([
      db.document.findUnique({ where: { id }, select: { communeCode: true } }),
      db.operation.findUnique({ where: { id: operationId }, select: { communeCode: true } }),
    ]);
    if (!doc || !op || doc.communeCode !== op.communeCode) return Response.json({ erreur: "Chantier d'une autre commune" }, { status: 400 });
  }
  const doc = await db.document.update({
    where: { id },
    data: {
      ...reste,
      ...(operationId !== undefined ? { operationId } : {}),
      ...(dateDocument !== undefined
        ? { dateDocument: dateDocument ? new Date(`${dateDocument}T00:00:00Z`) : null, ...(dateDocument ? { annee: Number(dateDocument.slice(0, 4)) } : {}) }
        : {}),
    },
  });
  return Response.json({ ok: true, titre: doc.titre });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, select: { titre: true, statut: true, travail: true, erreur: true, cheminPublic: true } });
  if (!doc) return Response.json({ erreur: "Introuvable" }, { status: 404 });
  return Response.json({ titre: doc.titre, statut: doc.statut, travail: doc.travail, erreur: doc.erreur, aVersionPublique: !!doc.cheminPublic });
}

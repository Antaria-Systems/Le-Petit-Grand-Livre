import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { invaliderVersionPublique } from "@/lib/admin-documents";
import { CATEGORIES } from "@/lib/admin-schemas";
import { db } from "@/lib/db";
import { supprimerFichiersDocument } from "@/lib/stockage";

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
  // Document déposé sur la mauvaise commune
  communeCode: z.string().regex(/^[0-9AB]{5}$/).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json().catch(() => null));
  if (!donnees.success) return Response.json({ erreur: donnees.error.message }, { status: 400 });
  const { dateDocument, operationId, communeCode, ...reste } = donnees.data;
  if (communeCode) {
    const [doc, cible] = await Promise.all([
      db.document.findUnique({ where: { id }, select: { communeCode: true, sha256Original: true } }),
      db.commune.findUnique({ where: { code: communeCode }, select: { nom: true } }),
    ]);
    if (!doc) return Response.json({ erreur: "Document introuvable" }, { status: 404 });
    if (!cible) return Response.json({ erreur: `Aucune commune avec le code INSEE ${communeCode}` }, { status: 400 });
    if (doc.communeCode !== communeCode) {
      const doublon = await db.document.findFirst({ where: { communeCode, sha256Original: doc.sha256Original }, select: { id: true } });
      if (doublon) return Response.json({ erreur: `Ce document existe déjà pour ${cible.nom}` }, { status: 409 });
      // Le chantier, la demande, l'échange et les relevés d'élus étaient ceux de l'ancienne commune.
      await db.$transaction([
        db.document.update({ where: { id }, data: { communeCode, operationId: null, demandeId: null, messageId: null } }),
        db.indemniteFonction.updateMany({ where: { documentId: id }, data: { documentId: null } }),
        db.fraisFonction.updateMany({ where: { documentId: id }, data: { documentId: null } }),
      ]);
      // La mention en pied de page cite la commune : la version publique est à régénérer.
      await invaliderVersionPublique(id);
      return Response.json({ ok: true, commune: cible.nom });
    }
  }
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

/** Suppression définitive d'un document NON publié (erreur de dépôt) : base, original chiffré, aperçus. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, select: { id: true, statut: true, travail: true, cheminChiffre: true, cheminPublic: true } });
  if (!doc) return Response.json({ ok: true });
  if (doc.statut === "PUBLIE") return Response.json({ erreur: "Dépubliez d'abord le document." }, { status: 409 });
  if (doc.travail) return Response.json({ erreur: "Un traitement est en cours sur ce document : réessayez dans un instant." }, { status: 409 });
  await db.document.delete({ where: { id } });
  await supprimerFichiersDocument(doc);
  return Response.json({ ok: true });
}

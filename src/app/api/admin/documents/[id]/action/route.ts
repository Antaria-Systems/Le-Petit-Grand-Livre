import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const schema = z.object({
  action: z.enum(["valider-tout", "generer", "publier", "depublier", "non-publiable", "reanalyser"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json());
  if (!donnees.success) return Response.json({ erreur: "Action inconnue" }, { status: 400 });
  const doc = await db.document.findUniqueOrThrow({ where: { id }, include: { _count: { select: { zones: { where: { validee: false } } } } } });
  const erreur = (message: string) => Response.json({ erreur: message }, { status: 409 });

  switch (donnees.data.action) {
    case "valider-tout":
      await db.zoneOccultation.updateMany({ where: { documentId: id }, data: { validee: true } });
      break;
    case "generer":
      if (doc._count.zones > 0) return erreur("Validez ou supprimez d'abord toutes les zones proposées.");
      await db.document.update({ where: { id }, data: { travail: "GENERER", erreur: null } });
      break;
    case "publier":
      if (doc.statut !== "OCCULTE" || !doc.cheminPublic) return erreur("Générez d'abord la version occultée, à jour.");
      await db.document.update({ where: { id }, data: { statut: "PUBLIE", publieLe: new Date() } });
      break;
    case "depublier":
      await db.document.update({ where: { id }, data: { statut: doc.cheminPublic ? "OCCULTE" : "A_VERIFIER", publieLe: null } });
      break;
    case "non-publiable":
      await db.document.update({ where: { id }, data: { statut: "NON_PUBLIABLE", publieLe: null } });
      break;
    case "reanalyser":
      await db.document.update({ where: { id }, data: { travail: "ANALYSER", statut: "RECU", publieLe: null } });
      break;
  }
  return Response.json({ ok: true });
}

import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const schema = z.object({
  action: z.enum(["valider-tout", "generer", "terminer", "publier", "depublier", "non-publiable", "reanalyser"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const donnees = schema.safeParse(await req.json().catch(() => null));
  if (!donnees.success) return Response.json({ erreur: "Action inconnue" }, { status: 400 });
  const doc = await db.document.findUnique({ where: { id }, include: { _count: { select: { zones: { where: { validee: false } } } } } });
  if (!doc) return Response.json({ erreur: "Document introuvable" }, { status: 404 });
  // Toute action rend une génération en cours obsolète (le worker jettera son résultat).
  const rev = { revision: { increment: 1 } };
  const erreur = (message: string) => Response.json({ erreur: message }, { status: 409 });

  switch (donnees.data.action) {
    case "valider-tout":
      await db.$transaction([
        db.zoneOccultation.updateMany({ where: { documentId: id }, data: { validee: true } }),
        db.document.update({ where: { id }, data: rev }),
      ]);
      break;
    case "generer":
      if (doc._count.zones > 0) return erreur("Validez ou supprimez d'abord toutes les zones proposées.");
      if (doc.statut === "NON_PUBLIABLE") return erreur("Ce document est marqué non publiable.");
      await db.document.update({ where: { id }, data: { ...rev, travail: "GENERER", erreur: null, tentatives: 0 } });
      break;
    case "terminer":
      // Vérification terminée : tout valider, générer, puis publier automatiquement (worker).
      if (doc.statut === "NON_PUBLIABLE") return erreur("Ce document est marqué non publiable.");
      if (!doc.nbPages) return erreur("Le document n'a pas encore été analysé.");
      await db.$transaction([
        db.zoneOccultation.updateMany({ where: { documentId: id }, data: { validee: true } }),
        db.document.update({ where: { id }, data: { ...rev, travail: "GENERER", publierApresGeneration: true, erreur: null, tentatives: 0 } }),
      ]);
      break;
    case "publier":
      if (doc.statut !== "OCCULTE" || !doc.cheminPublic || doc.travail) return erreur("Générez d'abord la version occultée, à jour.");
      await db.document.update({ where: { id }, data: { statut: "PUBLIE", publieLe: new Date(), erreur: null } });
      break;
    case "depublier":
      await db.document.update({
        where: { id },
        data: { ...rev, statut: doc.cheminPublic ? "OCCULTE" : "A_VERIFIER", publieLe: null, publierApresGeneration: false, travail: doc.travail === "GENERER" ? null : doc.travail },
      });
      break;
    case "non-publiable":
      await db.document.update({ where: { id }, data: { ...rev, statut: "NON_PUBLIABLE", publieLe: null, publierApresGeneration: false, travail: null } });
      break;
    case "reanalyser":
      await db.document.update({ where: { id }, data: { ...rev, travail: "ANALYSER", statut: "RECU", publieLe: null, publierApresGeneration: false, erreur: null, tentatives: 0 } });
      break;
  }
  return Response.json({ ok: true });
}

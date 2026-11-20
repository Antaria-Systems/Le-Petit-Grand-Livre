import { refusAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { lirePublic } from "@/lib/stockage";

/** Prévisualisation de la version occultée, même avant publication. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = refusAdmin(req);
  if (refus) return refus;
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, select: { cheminPublic: true } });
  if (!doc?.cheminPublic) return new Response("Pas encore de version occultée", { status: 404 });
  const pdf = await lirePublic(doc.cheminPublic);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
}

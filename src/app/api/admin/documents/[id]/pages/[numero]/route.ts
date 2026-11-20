import { refusAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { lireChiffre } from "@/lib/stockage";

/** Aperçu NON occulté d'une page : réservé à l'administration, jamais mis en cache. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const refus = refusAdmin(req);
  if (refus) return refus;
  const { id, numero } = await params;
  const page = await db.pageDocument.findUnique({ where: { documentId_numero: { documentId: id, numero: Number(numero) } } });
  if (!page) return new Response("Page introuvable", { status: 404 });
  const image = await lireChiffre(page.cheminChiffre);
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}

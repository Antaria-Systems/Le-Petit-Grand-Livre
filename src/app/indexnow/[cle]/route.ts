import { cleIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/** Fichier de clé IndexNow, publié à la racine du site (/<clé>.txt, réécrit ici par next.config.ts). */
export async function GET(_req: Request, { params }: { params: Promise<{ cle: string }> }) {
  const cle = cleIndexNow();
  if (!cle || (await params).cle !== cle) return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(cle, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
}

import { db } from "@/lib/db";

/**
 * Fond de carte d'un département (toutes ses communes), mis en cache et partagé par toutes les fiches.
 * Les tracés n'ont pas de couleur propre : la page les colore via <use> (thème clair ou sombre).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const code = (await params).fichier.match(/^([0-9AB]{2,3})\.svg$/)?.[1];
  if (!code) return new Response("Introuvable", { status: 404 });
  const dep = await db.departement.findUnique({
    where: { code },
    select: { carteViewBox: true, communes: { where: { cheminCarte: { not: null } }, select: { cheminCarte: true } } },
  });
  if (!dep?.carteViewBox) return new Response("Introuvable", { status: 404 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${dep.carteViewBox}"><g id="fond">${dep.communes
    .map((c) => `<path d="${c.cheminCarte}"/>`)
    .join("")}</g></svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

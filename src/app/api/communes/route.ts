import { NextResponse, type NextRequest } from "next/server";
import { rechercherCommunes, type ResultatRecherche } from "@/lib/recherche";

export type { ResultatRecherche };

/* Limitation simple par adresse IP (API publique interrogée à chaque frappe). */
const fenetres = new Map<string, { debut: number; n: number }>();
function tropDeRequetes(ip: string): boolean {
  const maintenant = Date.now();
  const f = fenetres.get(ip);
  if (!f || maintenant - f.debut > 60_000) {
    fenetres.set(ip, { debut: maintenant, n: 1 });
    if (fenetres.size > 10_000) fenetres.clear();
    return false;
  }
  return ++f.n > 120;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (tropDeRequetes(ip)) return NextResponse.json([], { status: 429, headers: { "Retry-After": "60" } });
  const resultats = await rechercherCommunes(req.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json(resultats, { headers: { "Cache-Control": "public, max-age=300" } });
}

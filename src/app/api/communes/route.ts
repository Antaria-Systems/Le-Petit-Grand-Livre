import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normaliser } from "@/lib/texte";

export type ResultatRecherche = { nom: string; slug: string; departement: string; codesPostaux: string[]; population: number | null };

export async function GET(req: NextRequest) {
  const brut = req.nextUrl.searchParams.get("q") ?? "";
  const q = normaliser(brut).slice(0, 60);
  if (q.length < 2) return NextResponse.json([]);

  const parCodePostal = /^\d{5}$/.test(q.replace(/ /g, ""));
  const communes = await db.commune.findMany({
    where: parCodePostal
      ? { OR: [{ codesPostaux: { has: q.replace(/ /g, "") } }, { code: q.replace(/ /g, "") }] }
      : { nomRecherche: { contains: q } },
    select: { nom: true, slug: true, nomRecherche: true, codesPostaux: true, population: true, departement: { select: { nom: true, code: true } } },
    take: 60,
  });

  const resultats: ResultatRecherche[] = communes
    .sort((a, b) => {
      const pa = a.nomRecherche.startsWith(q) ? 0 : 1;
      const pb = b.nomRecherche.startsWith(q) ? 0 : 1;
      return pa - pb || (b.population ?? 0) - (a.population ?? 0);
    })
    .slice(0, 8)
    .map((c) => ({
      nom: c.nom,
      slug: c.slug,
      departement: `${c.departement.nom} (${c.departement.code})`,
      codesPostaux: c.codesPostaux,
      population: c.population,
    }));

  return NextResponse.json(resultats, { headers: { "Cache-Control": "public, max-age=300" } });
}

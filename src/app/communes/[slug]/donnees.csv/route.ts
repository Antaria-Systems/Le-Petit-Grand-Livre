import { db } from "@/lib/db";

/** Export ouvert des agrégats financiers d'une commune (Licence Ouverte, source OFGL). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const commune = await db.commune.findUnique({ where: { slug }, select: { code: true, nom: true } });
  if (!commune) return new Response("Commune introuvable", { status: 404 });
  const lignes = await db.agregatFinancier.findMany({
    where: { communeCode: commune.code },
    orderBy: [{ exercice: "asc" }, { typeBudget: "asc" }, { agregat: "asc" }],
  });
  const echapper = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [
    "code_insee;commune;exercice;type_budget;agregat;montant_euros;euros_par_habitant",
    ...lignes.map((l) =>
      [commune.code, commune.nom, l.exercice, l.typeBudget, l.agregat, l.montant.toFixed(2), l.parHabitant?.toFixed(2) ?? ""].map((v) => echapper(String(v))).join(";"),
    ),
  ].join("\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-finances-ofgl.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

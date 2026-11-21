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
  const dep = await db.commune.findUnique({ where: { slug }, select: { departementCode: true } });
  const importe = await db.etat.findUnique({ where: { cle: `import:finances:${dep?.departementCode}` } });
  const miseAJour = importe ? importe.valeur.slice(0, 10) : "";
  const echapper = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  // Deux décimales, sans « -0.00 » pour les arrondis de zéro.
  const fixe = (x: number) => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2);
  const budget = (t: string) => (t === "Budget annexe" ? "Budgets annexes (cumulés)" : t);
  const csv = [
    "code_insee;commune;exercice;type_budget;agregat;montant_euros;euros_par_habitant;source;licence;mise_a_jour",
    ...lignes.map((l) =>
      [
        commune.code,
        commune.nom,
        l.exercice,
        budget(l.typeBudget),
        l.agregat,
        fixe(l.montant),
        l.parHabitant === null ? "" : fixe(l.parHabitant),
        "OFGL (data.ofgl.fr), comptes DGFiP",
        "Licence Ouverte 2.0",
        miseAJour,
      ]
        .map((v) => echapper(String(v)))
        .join(";"),
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

import { db } from "./db";

export type PagePlan = { chemin: string; modifieLe?: Date; frequence: "weekly" | "monthly" | "yearly"; priorite: number };

/**
 * Pages publiques à faire connaître aux moteurs : pages fixes, territoires couverts et fiches de
 * toutes les communes des départements couverts. Sert au plan du site (sitemap.xml) et à la première
 * soumission IndexNow.
 */
export async function pagesDuSite(): Promise<PagePlan[]> {
  const [departements, communes, publications] = await Promise.all([
    db.departement.findMany({ where: { actif: true }, select: { code: true, regionCode: true } }),
    db.commune.findMany({ where: { departement: { actif: true } }, select: { slug: true, code: true, majLe: true } }),
    db.document.groupBy({ by: ["communeCode"], where: { statut: "PUBLIE" }, _max: { publieLe: true } }),
  ]);
  const publie = new Map(publications.map((p) => [p.communeCode, p._max.publieLe]));
  return [
    { chemin: "/", frequence: "weekly", priorite: 1 },
    { chemin: "/regions", frequence: "monthly", priorite: 0.6 },
    { chemin: "/methodologie", frequence: "monthly", priorite: 0.5 },
    { chemin: "/a-propos", frequence: "yearly", priorite: 0.3 },
    { chemin: "/mentions-legales", frequence: "yearly", priorite: 0.1 },
    ...[...new Set(departements.map((d) => d.regionCode))].map((r): PagePlan => ({ chemin: `/regions/${r}`, frequence: "monthly", priorite: 0.5 })),
    ...departements.map((d): PagePlan => ({ chemin: `/departements/${d.code}`, frequence: "weekly", priorite: 0.7 })),
    ...communes.map((c): PagePlan => {
      const p = publie.get(c.code);
      return { chemin: `/communes/${c.slug}`, modifieLe: p && p > c.majLe ? p : c.majLe, frequence: "monthly", priorite: p ? 0.9 : 0.6 };
    }),
  ];
}

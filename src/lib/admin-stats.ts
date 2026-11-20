import { db } from "./db";

/** Compteurs par commune pour les vues d'administration (documents, chantiers, demandes). */
export async function statsCommunes(codes: string[]) {
  const [docs, chantiers, demandes] = await Promise.all([
    db.document.groupBy({ by: ["communeCode", "statut"], where: { communeCode: { in: codes } }, _count: true }),
    db.operation.groupBy({ by: ["communeCode"], where: { communeCode: { in: codes } }, _count: true }),
    db.demande.findMany({ where: { communeCode: { in: codes } }, orderBy: { annee: "desc" }, select: { communeCode: true, statut: true, annee: true } }),
  ]);
  const res = new Map<string, { publies: number; aTraiter: number; total: number; chantiers: number; derniereDemande: { statut: string; annee: number } | null }>();
  const obtenir = (c: string) => {
    if (!res.has(c)) res.set(c, { publies: 0, aTraiter: 0, total: 0, chantiers: 0, derniereDemande: null });
    return res.get(c)!;
  };
  for (const d of docs) {
    const s = obtenir(d.communeCode);
    s.total += d._count;
    if (d.statut === "PUBLIE") s.publies += d._count;
    if (d.statut === "A_VERIFIER" || d.statut === "RECU" || d.statut === "EN_ANALYSE" || d.statut === "OCCULTE") s.aTraiter += d._count;
  }
  for (const c of chantiers) obtenir(c.communeCode).chantiers = c._count;
  for (const d of demandes) if (!obtenir(d.communeCode).derniereDemande) obtenir(d.communeCode).derniereDemande = { statut: d.statut, annee: d.annee };
  return res;
}

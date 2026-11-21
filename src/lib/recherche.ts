/**
 * Recherche de communes : préfixe d'abord, puis contenu, triés par population AVANT la troncature ;
 * « St » / « Ste » compris comme « Saint » / « Sainte » ; tolérance aux fautes de frappe
 * (trigrammes) quand rien ne correspond exactement.
 */
import { db } from "./db";
import { normaliser } from "./texte";

export type ResultatRecherche = { nom: string; slug: string; departement: string; codesPostaux: string[]; population: number | null };

/** Texte de la requête : normalisé, abréviations courantes développées. */
export function requeteRecherche(brut: string): string {
  return normaliser(brut)
    .split(" ")
    .map((m) => (m === "st" ? "saint" : m === "ste" ? "sainte" : m))
    .join(" ")
    .slice(0, 60);
}

const select = { nom: true, slug: true, nomRecherche: true, codesPostaux: true, population: true, departement: { select: { nom: true, code: true } } } as const;
type Ligne = { nom: string; slug: string; nomRecherche: string; codesPostaux: string[]; population: number | null; departement: { nom: string; code: string } };

const versResultat = (c: Ligne): ResultatRecherche => ({
  nom: c.nom,
  slug: c.slug,
  departement: `${c.departement.nom} (${c.departement.code})`,
  codesPostaux: c.codesPostaux,
  population: c.population,
});

/* Index des noms pour la recherche approchée (communes des départements couverts), rafraîchi toutes les 10 min. */
let index: { lignes: Ligne[]; trigrammes: Set<string>[]; le: number } | null = null;
const trigrammes = (s: string) => {
  const t = new Set<string>();
  const x = `  ${s} `;
  for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3));
  return t;
};
async function indexApproche() {
  if (index && Date.now() - index.le < 600_000) return index;
  const lignes = await db.commune.findMany({ where: { departement: { actif: true } }, select });
  index = { lignes, trigrammes: lignes.map((l) => trigrammes(l.nomRecherche)), le: Date.now() };
  return index;
}

export async function rechercherCommunes(brut: string, limite = 8): Promise<ResultatRecherche[]> {
  const q = requeteRecherche(brut);
  if (q.length < 2) return [];
  const cp = q.replace(/ /g, "");
  if (/^\d{5}$/.test(cp)) {
    const r = await db.commune.findMany({ where: { OR: [{ codesPostaux: { has: cp } }, { code: cp }] }, select, orderBy: { population: { sort: "desc", nulls: "last" } }, take: limite });
    return r.map(versResultat);
  }
  const prefixe = await db.commune.findMany({ where: { nomRecherche: { startsWith: q } }, select, orderBy: { population: { sort: "desc", nulls: "last" } }, take: limite });
  const contenu =
    prefixe.length < limite
      ? await db.commune.findMany({
          where: { nomRecherche: { contains: q }, NOT: { nomRecherche: { startsWith: q } } },
          select,
          orderBy: { population: { sort: "desc", nulls: "last" } },
          take: limite - prefixe.length,
        })
      : [];
  const exacts = [...prefixe, ...contenu];
  if (exacts.length > 0 || q.length < 4) return exacts.map(versResultat);

  // Rien d'exact : recherche approchée (« carcasone », « limou »…).
  const { lignes, trigrammes: tg } = await indexApproche();
  const tq = trigrammes(q);
  return lignes
    .map((l, i) => {
      let commun = 0;
      for (const t of tq) if (tg[i].has(t)) commun++;
      return { l, score: commun / (tq.size + tg[i].size - commun) };
    })
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score || (b.l.population ?? 0) - (a.l.population ?? 0))
    .slice(0, limite)
    .map((x) => versResultat(x.l));
}

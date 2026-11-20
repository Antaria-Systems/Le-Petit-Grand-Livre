/**
 * Imports open data d'un département : communes et carte (geo.api.gouv.fr), finances (OFGL),
 * coordonnées des mairies (annuaire service-public). Utilisés par les scripts et par le worker.
 */
import { projeterDepartement, type Geometrie } from "../carte";
import { departementsActifs } from "../config";
import { db } from "../db";
import { normaliser, slugCommune } from "../texte";
import { getJson, odsExport } from "./http";

export type Journal = (ligne: string) => void | Promise<void>;

const GEO = "https://geo.api.gouv.fr";
const OFGL = "https://data.ofgl.fr";
const ANNUAIRE = "https://api-lannuaire.service-public.fr";
const JEU_OFGL = "ofgl-base-communes";

/** Départements couverts : ceux activés en base, plus ceux de DEPARTEMENTS_ACTIFS. */
export async function codesDepartementsActifs(): Promise<string[]> {
  const enBase = (await db.departement.findMany({ where: { actif: true }, select: { code: true } })).map((d) => d.code);
  return [...new Set([...enBase, ...departementsActifs()])].sort();
}

export async function importerReferentiel(log: Journal) {
  const regions = await getJson<{ code: string; nom: string }[]>(`${GEO}/regions`);
  const departements = await getJson<{ code: string; nom: string; codeRegion: string }[]>(`${GEO}/departements`);
  const env = departementsActifs();
  for (const r of regions) await db.region.upsert({ where: { code: r.code }, create: r, update: { nom: r.nom } });
  for (const d of departements) {
    // Un département activé (en base ou par l'environnement) n'est jamais désactivé par un import.
    await db.departement.upsert({
      where: { code: d.code },
      create: { code: d.code, nom: d.nom, regionCode: d.codeRegion, actif: env.includes(d.code) },
      update: { nom: d.nom, regionCode: d.codeRegion, ...(env.includes(d.code) ? { actif: true } : {}) },
    });
  }
  await log(`${regions.length} régions, ${departements.length} départements`);
}

export async function importerCommunes(dep: string, log: Journal) {
  type C = { code: string; nom: string; population?: number; codesPostaux: string[]; siren?: string };
  const communes = await getJson<C[]>(`${GEO}/departements/${dep}/communes?fields=nom,code,population,codesPostaux,siren`);
  await db.$transaction(
    communes.map((c) => {
      const data = {
        nom: c.nom,
        nomRecherche: normaliser(c.nom),
        slug: slugCommune(c.nom, c.code),
        departementCode: dep,
        population: c.population ?? null,
        codesPostaux: c.codesPostaux,
        siren: c.siren ?? null,
      };
      return db.commune.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
    }),
  );
  await log(`Département ${dep} : ${communes.length} communes`);

  const geo = await getJson<{ features: { properties: { code: string }; geometry: Geometrie }[] }>(
    `${GEO}/departements/${dep}/communes?fields=code,contour&format=geojson&geometry=contour`,
  );
  const { viewBox, chemins } = projeterDepartement(new Map(geo.features.map((f) => [f.properties.code, f.geometry])));
  await db.departement.update({ where: { code: dep }, data: { carteViewBox: viewBox } });
  await db.$transaction([...chemins].map(([code, d]) => db.commune.updateMany({ where: { code }, data: { cheminCarte: d } })));
  await log(`Département ${dep} : carte de situation (${chemins.size} contours)`);
}

type LigneOfgl = {
  exer: string;
  com_code: string;
  agregat: string;
  type_de_budget: string;
  montant: number | null;
  euros_par_habitant: number | null;
  tranche_population: string | null;
  epci_name: string | null;
};
const annee = (exer: string) => Number(exer.slice(0, 4));

export async function importerFinances(dep: string, log: Journal) {
  const lignes = await getJson<LigneOfgl[]>(
    odsExport(OFGL, JEU_OFGL, {
      where: `dep_code='${dep}'`,
      select: "exer,com_code,agregat,type_de_budget,montant,euros_par_habitant,tranche_population,epci_name",
    }),
  );
  const connues = new Set((await db.commune.findMany({ where: { departementCode: dep }, select: { code: true } })).map((c) => c.code));
  const cumul = new Map<string, { communeCode: string; exercice: number; agregat: string; typeBudget: string; montant: number; parHabitant: number | null }>();
  const infos = new Map<string, { exercice: number; strate: number | null; epciNom: string | null }>();
  for (const l of lignes) {
    if (!connues.has(l.com_code) || l.montant === null) continue;
    const exercice = annee(l.exer);
    const cle = `${l.com_code}|${exercice}|${l.agregat}|${l.type_de_budget}`;
    const e = cumul.get(cle);
    // Les budgets annexes d'une même commune sont cumulés par agrégat.
    if (e) {
      e.montant += l.montant;
      e.parHabitant = (e.parHabitant ?? 0) + (l.euros_par_habitant ?? 0);
    } else {
      cumul.set(cle, { communeCode: l.com_code, exercice, agregat: l.agregat, typeBudget: l.type_de_budget, montant: l.montant, parHabitant: l.euros_par_habitant });
    }
    const info = infos.get(l.com_code);
    if (l.type_de_budget === "Budget principal" && (!info || info.exercice < exercice)) {
      infos.set(l.com_code, { exercice, strate: l.tranche_population === null ? null : Number(l.tranche_population), epciNom: l.epci_name });
    }
  }
  const donnees = [...cumul.values()];
  await db.agregatFinancier.deleteMany({ where: { commune: { departementCode: dep } } });
  for (let i = 0; i < donnees.length; i += 5000) await db.agregatFinancier.createMany({ data: donnees.slice(i, i + 5000) });
  for (const [code, info] of infos) await db.commune.update({ where: { code }, data: { strate: info.strate, epciNom: info.epciNom } });
  await log(`Département ${dep} : ${donnees.length} agrégats financiers pour ${infos.size} communes`);
}

export async function importerReferencesStrates(log: Journal) {
  type L = { exer: string; tranche_population: string; agregat: string; med: number | null; moy: number | null; n: number };
  const lignes = await getJson<L[]>(
    odsExport(OFGL, JEU_OFGL, {
      where: "type_de_budget='Budget principal' and euros_par_habitant is not null",
      select: "exer,tranche_population,agregat,median(euros_par_habitant) as med,avg(euros_par_habitant) as moy,count(*) as n",
      group_by: "exer,tranche_population,agregat",
    }),
  );
  const data = lignes
    .filter((l) => l.med !== null && l.moy !== null && l.tranche_population !== null)
    .map((l) => ({ exercice: annee(l.exer), strate: Number(l.tranche_population), agregat: l.agregat, medianeParHabitant: l.med!, moyenneParHabitant: l.moy!, nbCommunes: l.n }));
  await db.referenceStrate.deleteMany();
  await db.referenceStrate.createMany({ data });
  await log(`Médianes nationales : ${data.length} références`);
}

export async function importerAnnuaire(dep: string, log: Journal) {
  type L = { code_insee_commune: string; adresse_courriel: string | null; telephone: string | null; adresse: string | null; site_internet: string | null };
  const premier = <T,>(json: string | null): T | null => {
    try {
      return json ? ((JSON.parse(json) as T[])[0] ?? null) : null;
    } catch {
      return null;
    }
  };
  const adresse = (json: string | null) => {
    const a = premier<Record<string, string>>(json);
    if (!a) return null;
    return [a.numero_voie, a.complement1, a.complement2, a.service_distribution, `${a.code_postal ?? ""} ${a.nom_commune ?? ""}`.trim()].filter((p) => p && p.trim()).join(", ") || null;
  };
  const lignes = await getJson<L[]>(
    odsExport(ANNUAIRE, "api-lannuaire-administration", {
      where: `startswith(code_insee_commune,'${dep}') and pivot like 'mairie'`,
      select: "code_insee_commune,adresse_courriel,telephone,adresse,site_internet",
    }),
  );
  let maj = 0;
  for (const l of lignes) {
    // Les coordonnées saisies à la main dans l'admin priment : on ne complète que les champs vides.
    const c = await db.commune.findUnique({ where: { code: l.code_insee_commune }, select: { mairieEmail: true, mairieTelephone: true, mairieAdresse: true, mairieSite: true } });
    if (!c) continue;
    await db.commune.update({
      where: { code: l.code_insee_commune },
      data: {
        mairieEmail: c.mairieEmail ?? (l.adresse_courriel?.split(";")[0]?.trim() || null),
        mairieTelephone: c.mairieTelephone ?? premier<{ valeur: string }>(l.telephone)?.valeur ?? null,
        mairieAdresse: c.mairieAdresse ?? adresse(l.adresse),
        mairieSite: c.mairieSite ?? premier<{ valeur: string }>(l.site_internet)?.valeur ?? null,
      },
    });
    maj++;
  }
  await log(`Département ${dep} : coordonnées de ${maj} mairies`);
}

/** Import complet d'un département (activation depuis l'admin). */
export async function importerDepartement(dep: string, log: Journal) {
  await importerReferentiel(log);
  await db.departement.update({ where: { code: dep }, data: { actif: true } });
  await importerCommunes(dep, log);
  await importerFinances(dep, log);
  await importerAnnuaire(dep, log);
  if ((await db.referenceStrate.count()) === 0) await importerReferencesStrates(log);
  await log(`Département ${dep} : import terminé`);
}

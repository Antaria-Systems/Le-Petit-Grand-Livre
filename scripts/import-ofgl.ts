/**
 * Finances des communes : agrégats comptables OFGL (budget principal et budgets
 * annexes cumulés) + médianes nationales par strate de population.
 * Source : data.ofgl.fr, jeu « ofgl-base-communes » (Licence Ouverte).
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { departementsActifs } from "../src/lib/config";
import { getJson, odsExport } from "./http";

const OFGL = "https://data.ofgl.fr";
const JEU = "ofgl-base-communes";

type LigneOfgl = {
  exer: string;
  com_code: string;
  agregat: string;
  type_de_budget: string;
  montant: number | null;
  euros_par_habitant: number | null;
  tranche_population: string | null;
  epci_name: string | null;
  siren: string | null;
};

type LigneStrate = {
  exer: string;
  tranche_population: string;
  agregat: string;
  med: number | null;
  moy: number | null;
  n: number;
};

const annee = (exer: string) => Number(exer.slice(0, 4));

async function importerDepartement(dep: string) {
  const lignes = await getJson<LigneOfgl[]>(
    odsExport(OFGL, JEU, {
      where: `dep_code='${dep}'`,
      select: "exer,com_code,agregat,type_de_budget,montant,euros_par_habitant,tranche_population,epci_name,siren",
    }),
  );

  const connues = new Set((await db.commune.findMany({ where: { departementCode: dep }, select: { code: true } })).map((c) => c.code));

  // Les budgets annexes d'une même commune sont cumulés par agrégat.
  const cumul = new Map<string, { communeCode: string; exercice: number; agregat: string; typeBudget: string; montant: number; parHabitant: number | null }>();
  const infos = new Map<string, { exercice: number; strate: number | null; epciNom: string | null }>();

  for (const l of lignes) {
    if (!connues.has(l.com_code) || l.montant === null) continue;
    const exercice = annee(l.exer);
    const cle = `${l.com_code}|${exercice}|${l.agregat}|${l.type_de_budget}`;
    const existant = cumul.get(cle);
    if (existant) {
      existant.montant += l.montant;
      existant.parHabitant = (existant.parHabitant ?? 0) + (l.euros_par_habitant ?? 0);
    } else {
      cumul.set(cle, {
        communeCode: l.com_code,
        exercice,
        agregat: l.agregat,
        typeBudget: l.type_de_budget,
        montant: l.montant,
        parHabitant: l.euros_par_habitant,
      });
    }
    const info = infos.get(l.com_code);
    if (l.type_de_budget === "Budget principal" && (!info || info.exercice < exercice)) {
      infos.set(l.com_code, {
        exercice,
        strate: l.tranche_population === null ? null : Number(l.tranche_population),
        epciNom: l.epci_name,
      });
    }
  }

  const donnees = [...cumul.values()];
  await db.agregatFinancier.deleteMany({ where: { commune: { departementCode: dep } } });
  for (let i = 0; i < donnees.length; i += 5000) {
    await db.agregatFinancier.createMany({ data: donnees.slice(i, i + 5000) });
  }
  for (const [code, info] of infos) {
    await db.commune.update({ where: { code }, data: { strate: info.strate, epciNom: info.epciNom } });
  }
  console.log(`Département ${dep} : ${lignes.length} lignes OFGL → ${donnees.length} agrégats, ${infos.size} communes`);
}

async function importerReferencesStrates() {
  const lignes = await getJson<LigneStrate[]>(
    odsExport(OFGL, JEU, {
      where: "type_de_budget='Budget principal' and euros_par_habitant is not null",
      select: "exer,tranche_population,agregat,median(euros_par_habitant) as med,avg(euros_par_habitant) as moy,count(*) as n",
      group_by: "exer,tranche_population,agregat",
    }),
  );
  const data = lignes
    .filter((l) => l.med !== null && l.moy !== null && l.tranche_population !== null)
    .map((l) => ({
      exercice: annee(l.exer),
      strate: Number(l.tranche_population),
      agregat: l.agregat,
      medianeParHabitant: l.med!,
      moyenneParHabitant: l.moy!,
      nbCommunes: l.n,
    }));
  await db.referenceStrate.deleteMany();
  await db.referenceStrate.createMany({ data });
  console.log(`Références nationales : ${data.length} (exercice × strate × agrégat)`);
}

async function main() {
  for (const dep of departementsActifs()) await importerDepartement(dep);
  await importerReferencesStrates();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

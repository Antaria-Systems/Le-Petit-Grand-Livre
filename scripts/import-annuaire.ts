/** Coordonnées des mairies des départements couverts (sans écraser les saisies de l'admin). */
import "dotenv/config";
import { db } from "../src/lib/db";
import { codesDepartementsActifs, importerAnnuaire } from "../src/lib/imports";

const log = (l: string) => console.log(l);
(async () => {
  for (const dep of await codesDepartementsActifs()) await importerAnnuaire(dep, log);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

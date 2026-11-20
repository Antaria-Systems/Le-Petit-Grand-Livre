/** Référentiel (régions, départements) et communes + carte des départements couverts. */
import "dotenv/config";
import { db } from "../src/lib/db";
import { codesDepartementsActifs, importerCommunes, importerReferentiel } from "../src/lib/imports";

const log = (l: string) => console.log(l);
(async () => {
  await importerReferentiel(log);
  for (const dep of await codesDepartementsActifs()) await importerCommunes(dep, log);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

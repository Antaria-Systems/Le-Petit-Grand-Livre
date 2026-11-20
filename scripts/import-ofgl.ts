/** Finances OFGL des départements couverts + médianes nationales par strate. */
import "dotenv/config";
import { db } from "../src/lib/db";
import { codesDepartementsActifs, importerFinances, importerReferencesStrates } from "../src/lib/imports";

const log = (l: string) => console.log(l);
(async () => {
  for (const dep of await codesDepartementsActifs()) await importerFinances(dep, log);
  await importerReferencesStrates(log);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

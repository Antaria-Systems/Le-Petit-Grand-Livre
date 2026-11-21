/**
 * Durées de conservation (annoncées dans les mentions légales, RGPD art. 5.1.e) :
 * les originaux NON occultés (et leurs aperçus) sont supprimés cinq ans après la publication de
 * la version occultée. Seule la version publique, déjà occultée, est conservée.
 */
import { db } from "./db";
import { supprimerStockage } from "./stockage";

export const CONSERVATION_ORIGINAUX_ANS = 5;

export async function purgerOriginaux(log: (l: string) => void = console.log): Promise<number> {
  const limite = new Date();
  limite.setUTCFullYear(limite.getUTCFullYear() - CONSERVATION_ORIGINAUX_ANS);
  const docs = await db.document.findMany({
    where: { statut: "PUBLIE", publieLe: { lt: limite }, cheminChiffre: { not: "" }, travail: null },
    select: { id: true, cheminChiffre: true },
    take: 200,
  });
  for (const d of docs) {
    await supprimerStockage(d.cheminChiffre);
    await supprimerStockage(`apercus/${d.id}`);
    await db.$transaction([
      db.pageDocument.deleteMany({ where: { documentId: d.id } }),
      db.document.update({ where: { id: d.id }, data: { cheminChiffre: "", notes: undefined } }),
    ]);
  }
  if (docs.length) log(`[conservation] ${docs.length} original(aux) supprimé(s), publiés il y a plus de ${CONSERVATION_ORIGINAUX_ANS} ans`);
  return docs.length;
}

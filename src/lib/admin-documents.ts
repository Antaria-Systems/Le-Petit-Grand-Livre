import { db } from "./db";

/**
 * Toute modification des zones rend la version publique obsolète :
 *  - la révision du document est incrémentée (une génération en cours sera jetée par le worker) ;
 *  - une génération en attente est annulée, ainsi que la publication automatique de « Terminer » ;
 *  - si le document était publié, il est DÉPUBLIÉ immédiatement : la version en ligne pourrait
 *    exposer ce qu'on vient de masquer.
 */
export async function invaliderVersionPublique(id: string) {
  await db.$transaction([
    db.document.update({ where: { id }, data: { revision: { increment: 1 }, publierApresGeneration: false } }),
    db.document.updateMany({ where: { id, travail: "GENERER" }, data: { travail: null } }),
    db.document.updateMany({ where: { id, statut: { in: ["OCCULTE", "PUBLIE"] } }, data: { statut: "A_VERIFIER", publieLe: null } }),
  ]);
}

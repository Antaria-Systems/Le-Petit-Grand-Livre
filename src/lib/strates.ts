/** Strates de population utilisées par l'OFGL / la DGCL pour les communes. */
const LIBELLES: Record<number, string> = {
  0: "moins de 100 habitants",
  1: "100 à 199 habitants",
  2: "200 à 499 habitants",
  3: "500 à 1 999 habitants",
  4: "2 000 à 3 499 habitants",
  5: "3 500 à 4 999 habitants",
  6: "5 000 à 9 999 habitants",
  7: "10 000 à 19 999 habitants",
  8: "20 000 à 49 999 habitants",
  9: "50 000 à 99 999 habitants",
  10: "100 000 habitants et plus",
};

export function libelleStrate(strate: number | null | undefined): string {
  return strate === null || strate === undefined ? "strate inconnue" : (LIBELLES[strate] ?? "strate inconnue");
}

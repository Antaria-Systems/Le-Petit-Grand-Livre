/**
 * Lecture d'un montant saisi à la main, dans les formats courants :
 * « 1234,56 », « 1 234,56 € », « 1.234,56 », « 1234.56 », « 2 640,00€ ».
 * Renvoie NaN si la saisie n'est pas un montant (jamais null silencieusement).
 */
export function lireMontant(saisie: string): number {
  let v = saisie.replace(/[\s  €]/g, "").replace(/eur(os?)?$/i, "");
  if (v === "") return Number.NaN;
  const virgule = v.lastIndexOf(",");
  const point = v.lastIndexOf(".");
  if (virgule >= 0 && point >= 0) {
    // Le dernier séparateur est le séparateur décimal, l'autre sépare les milliers.
    v = virgule > point ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  } else if (virgule >= 0) {
    v = v.replace(",", ".");
  } else if (point >= 0 && /^\d{1,3}(\.\d{3})+$/.test(v)) {
    v = v.replace(/\./g, ""); // « 1.234 » ou « 12.345.678 » : séparateurs de milliers
  }
  if (!/^-?\d+(\.\d+)?$/.test(v)) return Number.NaN;
  return Number(v);
}

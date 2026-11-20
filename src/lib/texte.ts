/** Minuscules, sans accents, ponctuation remplacée par des espaces. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugCommune(nom: string, codeInsee: string): string {
  return `${normaliser(nom).replace(/ /g, "-")}-${codeInsee.toLowerCase()}`;
}

/** Prépositions et articles devant les noms de lieux : « de l'Aude », « du Gard », « d'Aigues-Vives ». */

const MASCULINS = new Set([
  "Bas-Rhin", "Calvados", "Cantal", "Cher", "Doubs", "Finistère", "Gard", "Gers", "Haut-Rhin", "Jura", "Loir-et-Cher", "Loiret", "Lot",
  "Lot-et-Garonne", "Maine-et-Loire", "Morbihan", "Nord", "Pas-de-Calais", "Puy-de-Dôme", "Rhône", "Tarn", "Tarn-et-Garonne",
  "Territoire de Belfort", "Val-d'Oise", "Val-de-Marne", "Var", "Vaucluse",
]);
const PLURIELS = new Set([
  "Alpes-de-Haute-Provence", "Alpes-Maritimes", "Ardennes", "Bouches-du-Rhône", "Côtes-d'Armor", "Deux-Sèvres", "Hautes-Alpes",
  "Hautes-Pyrénées", "Hauts-de-Seine", "Landes", "Pyrénées-Atlantiques", "Pyrénées-Orientales", "Vosges", "Yvelines",
]);
const SANS_ARTICLE = new Set(["Paris", "Mayotte", "La Réunion"]);

const voyelle = (nom: string) => /^[AEIOUYÉÈÊÂÎaeiouyéèêâî]/.test(nom) || /^Hérault/.test(nom);

/** « de l'Aude », « du Gard », « des Landes », « de la Gironde », « de Paris » */
export function deDepartement(nom: string): string {
  if (SANS_ARTICLE.has(nom)) return `de ${nom}`;
  if (PLURIELS.has(nom)) return `des ${nom}`;
  if (MASCULINS.has(nom)) return `du ${nom}`;
  if (voyelle(nom)) return `de l'${nom}`;
  return `de la ${nom}`;
}

/** « d'Aigues-Vives », « du Bousquet », « des Cassés », « de La Cassaigne », « de Lavalette » */
export function deCommune(nom: string): string {
  if (/^Le /.test(nom)) return `du ${nom.slice(3)}`;
  if (/^Les /.test(nom)) return `des ${nom.slice(4)}`;
  if (/^L'/.test(nom)) return `de ${nom}`;
  if (voyelle(nom)) return `d'${nom}`;
  return `de ${nom}`;
}

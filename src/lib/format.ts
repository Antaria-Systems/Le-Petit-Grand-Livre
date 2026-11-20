const euros0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euros2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });

// Intl utilise l'espace fine insécable (U+202F), trop étroite à petite taille : on la remplace par une espace insécable.
const esp = (s: string) => s.replace(/\u202f/g, "\u00a0");

export const formatEuros = (n: number) => esp(euros0.format(n));
export const formatEurosCentimes = (n: number) => esp(euros2.format(n));
export const formatEntier = (n: number) => esp(entier.format(n));
export const formatPourcentage = (n: number) => esp(pct.format(n));
export const formatDate = (d: Date) => dateLongue.format(d);
export const formatDateCourte = (d: Date) => dateCourte.format(d);

/** 1 234 567 € → « 1,2 M€ » ; 45 300 € → « 45 k€ ». */
export function formatEurosCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md€`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (abs >= 1e4) return `${formatEntier(n / 1e3)} k€`;
  return formatEuros(n);
}

export const formatParHabitant = (n: number) => `${formatEntier(n)} €/hab.`;

/** Dates et heures saisies et affichées en heure de Paris, quel que soit le fuseau du serveur. */

const FUSEAU = "Europe/Paris";

/** Décalage (ms) entre l'heure de Paris et UTC à un instant donné (gère l'heure d'été). */
function decalageParis(instant: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const v = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - instant;
}

/** « 2026-11-26T09:00 » (champ datetime-local, heure de Paris) → instant UTC. */
export function depuisHeureParis(local: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [a, mo, j, h, mi] = m.slice(1).map(Number);
  const naif = Date.UTC(a, mo - 1, j, h, mi);
  let t = naif - decalageParis(naif);
  t = naif - decalageParis(t); // second passage : exact autour des changements d'heure
  return new Date(t);
}

/** Instant → « 2026-11-26T09:00 » en heure de Paris (valeur d'un champ datetime-local). */
export function versHeureParis(d: Date): string {
  const local = new Date(d.getTime() + decalageParis(d.getTime()));
  return local.toISOString().slice(0, 16);
}

const formatLong = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatCourt = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** « jeudi 26 novembre 2026 à 09:00 » */
export const formatDateHeure = (d: Date) => formatLong.format(d);
/** « 26/11/2026 09:00 » */
export const formatDateHeureCourte = (d: Date) => formatCourt.format(d).replace(",", "");

/**
 * IndexNow : signale aux moteurs de recherche les pages qui viennent de changer, pour qu'ils les
 * explorent sans attendre leur prochain passage. Bing, Yandex, Seznam, Naver et Yep y participent ;
 * DuckDuckGo, Qwant, Ecosia et Yahoo s'appuient sur l'index de Bing. Google n'y participe pas : il
 * lit le plan du site (sitemap.xml, annoncé dans robots.txt).
 *
 * La clé (INDEXNOW_KEY, 32 caractères hexadécimaux) prouve que les soumissions viennent du site :
 * elle est publiée à la racine (/<clé>.txt) et n'a rien de secret. Sans clé, rien n'est envoyé.
 */
import { site } from "./config";
import { db } from "./db";
import { pagesDuSite } from "./plan-du-site";
import { urlAbsolue } from "./seo";

const POINT_D_ENTREE = "https://api.indexnow.org/indexnow";
const LOT_MAX = 10_000; // URL par requête, limite du protocole
const ETAT = "indexnow:depuis";

export function cleIndexNow(): string | null {
  const cle = process.env.INDEXNOW_KEY?.trim().toLowerCase();
  return cle && /^[0-9a-f]{32}$/.test(cle) ? cle : null;
}

/** Envoie une liste d'adresses du site (lots de 10 000). Lève une erreur si un moteur refuse. */
export async function soumettreIndexNow(urls: string[], envoyer: typeof fetch = fetch): Promise<void> {
  const cle = cleIndexNow();
  if (!cle || urls.length === 0) return;
  const hote = new URL(site.url).host;
  for (let i = 0; i < urls.length; i += LOT_MAX) {
    const rep = await envoyer(POINT_D_ENTREE, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: hote, key: cle, keyLocation: urlAbsolue(`/${cle}.txt`), urlList: urls.slice(i, i + LOT_MAX) }),
      signal: AbortSignal.timeout(30_000),
    });
    // 200 : reçu ; 202 : reçu, clé en cours de vérification. 403 : clé introuvable sur le site ; 422 : adresse hors du site ; 429 : trop de requêtes.
    if (rep.status !== 200 && rep.status !== 202) throw new Error(`IndexNow : réponse ${rep.status} ${rep.statusText}`);
  }
}

/**
 * Soumet les pages modifiées depuis la dernière soumission réussie : fiches dont la commune a changé
 * (import des comptes, présentation) ou qui ont reçu un document publié, avec leur département et
 * l'accueil. La première fois, tout le plan du site. Renvoie le nombre d'adresses soumises.
 */
export async function signalerPagesModifiees(): Promise<number> {
  if (!cleIndexNow() || !site.url.startsWith("https://")) return 0;
  const maintenant = new Date();
  const etat = await db.etat.findUnique({ where: { cle: ETAT } });
  let chemins: string[];
  if (!etat) {
    chemins = (await pagesDuSite()).map((p) => p.chemin);
  } else {
    const depuis = new Date(etat.valeur);
    const communes = await db.commune.findMany({
      where: { departement: { actif: true }, OR: [{ majLe: { gt: depuis } }, { documents: { some: { statut: "PUBLIE", publieLe: { gt: depuis } } } }] },
      select: { slug: true, departementCode: true },
    });
    chemins = communes.length
      ? ["/", ...new Set(communes.map((c) => `/departements/${c.departementCode}`)), ...communes.map((c) => `/communes/${c.slug}`)]
      : [];
  }
  await soumettreIndexNow(chemins.map(urlAbsolue));
  await db.etat.upsert({ where: { cle: ETAT }, create: { cle: ETAT, valeur: maintenant.toISOString() }, update: { valeur: maintenant.toISOString() } });
  return chemins.length;
}

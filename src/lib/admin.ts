/**
 * Contrôle d'accès à l'administration, vérifié à plusieurs niveaux (défense en profondeur) :
 * src/proxy.ts, le layout admin, chaque page (verifierAdminPage), chaque route API (refusAdmin)
 * et chaque action serveur (adminCourant).
 *  - Authentik (OIDC) quand ses quatre variables sont renseignées (groupe AUTH_ADMIN_GROUP requis) ;
 *  - sinon, HTTP Basic UNIQUEMENT si ADMIN_BASIC=1 (développement, dépannage) ;
 *  - sinon, administration fermée.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { site } from "./config";
import { basicActif, groupesAutorises, identifiantsValides, oidcActif, SESSION_MAX_MS } from "./admin-auth";

export { basicActif, oidcActif };

/** Utilisateur administrateur courant, ou null. */
export async function adminCourant(): Promise<{ nom: string; mode: "oidc" | "basic" } | null> {
  if (oidcActif()) {
    const session = await auth();
    if (!session?.user || !groupesAutorises(session.user.groups)) return null;
    if (!session.user.connecteLe || Date.now() - session.user.connecteLe > SESSION_MAX_MS) return null;
    return { nom: session.user.name ?? session.user.email ?? "Administrateur", mode: "oidc" };
  }
  return identifiantsValides((await headers()).get("authorization")) ? { nom: process.env.ADMIN_USER ?? "admin", mode: "basic" } : null;
}

/** Origines légitimes : celles de la configuration, jamais déduites des en-têtes de la requête. */
function originesAutorisees(): Set<string> {
  const o = new Set<string>();
  for (const u of [site.url, process.env.AUTH_URL]) {
    try {
      if (u) o.add(new URL(u).origin);
    } catch {
      /* URL de configuration invalide : ignorée */
    }
  }
  return o;
}

/** Les requêtes qui modifient des données doivent venir du site lui-même (protection CSRF). */
function memeOrigine(req: Request): boolean {
  const provenance = req.headers.get("sec-fetch-site");
  if (provenance) return provenance === "same-origin";
  const origine = req.headers.get("origin");
  if (!origine) return false;
  try {
    return originesAutorisees().has(new URL(origine).origin);
  } catch {
    return false;
  }
}

/** Pour les routes API : renvoie une réponse d'erreur, ou null si l'accès est autorisé. */
export async function refusAdmin(req: Request): Promise<Response | null> {
  if (!(await adminCourant())) {
    return basicActif()
      ? new Response("Authentification requise", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' } })
      : new Response("Non autorisé", { status: 401 });
  }
  if (req.method !== "GET" && req.method !== "HEAD" && !memeOrigine(req)) {
    return new Response("Origine refusée", { status: 403 });
  }
  return null;
}

/** Pour les pages serveur d'administration. */
export async function verifierAdminPage(): Promise<{ nom: string; mode: "oidc" | "basic" }> {
  const admin = await adminCourant();
  if (admin) return admin;
  if (oidcActif()) redirect("/connexion");
  notFound();
}

/** Mode Basic sans identifiants valides (pour les pages) : rien n'est rendu. */
export function adminFerme(): boolean {
  return !oidcActif() && !basicActif();
}

/**
 * Connexion administrateur par Authentik (OIDC), via Auth.js.
 * Accès réservé aux membres du groupe AUTH_ADMIN_GROUP (claim « groups » d'Authentik).
 */
import NextAuth, { type Account, type Profile } from "next-auth";
import Authentik from "next-auth/providers/authentik";
import { groupesAutorises } from "./lib/admin-auth";

let userinfoEndpoint: string | null = null;

/**
 * Groupes de l'utilisateur : depuis le jeton d'identité, sinon depuis l'endpoint userinfo
 * (Authentik n'inclut pas toujours les claims de profil dans l'id_token).
 */
async function groupes(profile: Profile | undefined, account: Account | null | undefined): Promise<string[] | undefined> {
  if (Array.isArray(profile?.groups)) return profile.groups as string[];
  if (!account?.access_token) return undefined;
  try {
    if (!userinfoEndpoint) {
      const issuer = (process.env.AUTH_AUTHENTIK_ISSUER ?? "").replace(/\/?$/, "/");
      const decouverte = await fetch(`${issuer}.well-known/openid-configuration`).then((r) => r.json());
      userinfoEndpoint = decouverte.userinfo_endpoint as string;
    }
    const info = await fetch(userinfoEndpoint, { headers: { Authorization: `Bearer ${account.access_token}` } }).then((r) => r.json());
    return Array.isArray(info.groups) ? (info.groups as string[]) : undefined;
  } catch {
    return undefined;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Authentik({
      clientId: process.env.AUTH_AUTHENTIK_ID,
      clientSecret: process.env.AUTH_AUTHENTIK_SECRET,
      issuer: process.env.AUTH_AUTHENTIK_ISSUER,
      authorization: { params: { scope: "openid email profile" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/connexion", error: "/connexion" },
  callbacks: {
    async signIn({ profile, account }) {
      const g = await groupes(profile, account);
      if (groupesAutorises(g)) return true;
      console.warn(
        `[auth] accès refusé pour ${profile?.preferred_username ?? profile?.email ?? "?"} : groupes reçus ${g ? JSON.stringify(g) : "(aucun claim « groups »)"}, groupe requis « ${process.env.AUTH_ADMIN_GROUP} »`,
      );
      return false;
    },
    async jwt({ token, profile, account }) {
      if (profile) {
        token.groups = (await groupes(profile, account)) ?? [];
        token.name = (profile.name as string | undefined) ?? (profile.preferred_username as string | undefined) ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.groups = (token.groups as string[] | undefined) ?? [];
      return session;
    },
  },
});

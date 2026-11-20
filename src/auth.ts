/**
 * Connexion administrateur par Authentik (OIDC), via Auth.js.
 * Accès réservé aux membres du groupe AUTH_ADMIN_GROUP (claim « groups » d'Authentik).
 */
import NextAuth from "next-auth";
import Authentik from "next-auth/providers/authentik";
import { groupesAutorises } from "./lib/admin-auth";

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
    signIn({ profile }) {
      return groupesAutorises(profile?.groups as string[] | undefined);
    },
    jwt({ token, profile }) {
      if (profile) {
        token.groups = (profile.groups as string[] | undefined) ?? [];
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

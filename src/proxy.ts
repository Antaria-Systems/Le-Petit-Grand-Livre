import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { basicActif, groupesAutorises, identifiantsValides, oidcActif, SESSION_MAX_MS } from "@/lib/admin-auth";

export const proxy = auth((req) => {
  const oidc = oidcActif();
  const connecteLe = (req.auth?.user as { connecteLe?: number } | undefined)?.connecteLe ?? 0;
  const autorise = oidc
    ? Boolean(req.auth?.user) && groupesAutorises(req.auth?.user?.groups) && Date.now() - connecteLe < SESSION_MAX_MS
    : identifiantsValides(req.headers.get("authorization"));

  if (!autorise) {
    // Ni Authentik ni accès Basic explicitement activé : l'administration est fermée.
    if (!oidc && !basicActif()) return new NextResponse("Administration non configurée", { status: 503 });
    if (!oidc) {
      return new NextResponse("Authentification requise", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
      });
    }
    if (req.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Non autorisé", { status: 401 });
    const url = new URL("/connexion", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

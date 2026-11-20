import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { groupesAutorises, identifiantsValides, oidcActif } from "@/lib/admin-auth";

export const proxy = auth((req) => {
  const oidc = oidcActif();
  const autorise = oidc
    ? Boolean(req.auth?.user) && groupesAutorises(req.auth?.user?.groups)
    : identifiantsValides(req.headers.get("authorization"));

  if (!autorise) {
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

import { NextResponse, type NextRequest } from "next/server";
import { identifiantsValides } from "@/lib/admin-auth";

export function proxy(req: NextRequest) {
  if (!identifiantsValides(req.headers.get("authorization"))) {
    return new NextResponse("Authentification requise", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
    });
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

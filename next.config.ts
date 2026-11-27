import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Fichier de clé IndexNow à la racine du site (voir src/lib/indexnow.ts).
  async rewrites() {
    return [{ source: "/:cle([0-9a-f]{32}).txt", destination: "/indexnow/:cle" }];
  },
  async headers() {
    const securite = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // HSTS : envoyé par le reverse proxy (Nginx Proxy Manager), pas ici, pour éviter un en-tête en double.
    ];
    // Politique de contenu : tout vient du site lui-même. Les scripts en ligne restent autorisés
    // (données de Next.js et script du thème), mais aucune source extérieure n'est chargée.
    // Pas de form-action : la connexion redirige vers Authentik après l'envoi du formulaire.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      { source: "/:path*", headers: securite },
      // Pas en développement (rechargement à chaud) ni sur les PDF (visionneuse du navigateur).
      ...(process.env.NODE_ENV === "production" ? [{ source: "/((?!documents/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] }] : []),
    ];
  },
};

export default nextConfig;

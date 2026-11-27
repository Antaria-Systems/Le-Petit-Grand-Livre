import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

// Rendu à la requête : à la construction de l'image, SITE_URL n'est pas encore connue.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/connexion", "/recherche"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.nom,
    short_name: site.nom,
    description: "Les finances des communes, en clair : budgets, travaux et documents obtenus auprès des mairies.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#1b3d8f",
    lang: "fr",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}

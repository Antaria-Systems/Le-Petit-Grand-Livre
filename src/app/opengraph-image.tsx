import { ImageResponse } from "next/og";
import { CarteOg } from "@/components/og/LogoOg";
import { site } from "@/lib/config";

export const alt = "Les finances des communes, en clair";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage par défaut (réseaux sociaux, messageries). */
export default function ImagePartage() {
  return new ImageResponse(
    <CarteOg site={site.nom} titre={site.nom} soustitre="Les finances des communes, en clair" pied="Plateforme associative indépendante" />,
    size,
  );
}

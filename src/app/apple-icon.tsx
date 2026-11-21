import { ImageResponse } from "next/og";
import { LogoOg } from "@/components/og/LogoOg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône pour l'écran d'accueil des téléphones. */
export default function IconeApple() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1b3d8f" }}>
        <LogoOg taille={180} />
      </div>
    ),
    size,
  );
}

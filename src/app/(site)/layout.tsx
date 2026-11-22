import { Apparition } from "@/components/Apparition";
import { Entete } from "@/components/Entete";
import { Pied } from "@/components/Pied";

/** Mise en page du site public : en-tête, contenu, pied de page. */
export default function MiseEnPageSite({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Entete />
      <main id="contenu">{children}</main>
      <Pied />
      <Apparition />
    </>
  );
}

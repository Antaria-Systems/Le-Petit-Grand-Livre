import Link from "next/link";
import { DonneesStructurees } from "@/components/DonneesStructurees";
import { filAriane } from "@/lib/seo";

export type Etape = { libelle: string; href?: string };

/**
 * Fil d'Ariane ; le dernier élément est la page courante. Repris pour les moteurs de recherche
 * (BreadcrumbList), qui l'affichent à la place de l'adresse dans leurs résultats.
 */
export function FilAriane({ elements }: { elements: Etape[] }) {
  const pourMoteurs = filAriane([{ libelle: "Accueil", href: "/" }, ...elements]);
  return (
    <>
      {pourMoteurs && <DonneesStructurees donnees={pourMoteurs} />}
      <nav className="fil-ariane" aria-label="Vous êtes ici">
        <ol>
          <li>
            <Link prefetch={false} href="/">Accueil</Link>
          </li>
          {elements.map((e) => (
            <li key={e.libelle}>{e.href ? <Link prefetch={false} href={e.href}>{e.libelle}</Link> : <span aria-current="page">{e.libelle}</span>}</li>
          ))}
        </ol>
      </nav>
    </>
  );
}

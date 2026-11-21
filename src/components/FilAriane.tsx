import Link from "next/link";

export type Etape = { libelle: string; href?: string };

/** Fil d'Ariane ; le dernier élément est la page courante. */
export function FilAriane({ elements }: { elements: Etape[] }) {
  return (
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
  );
}

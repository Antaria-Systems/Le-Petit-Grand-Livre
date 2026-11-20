import Link from "next/link";

export function FilAriane({ elements }: { elements: { libelle: string; href?: string }[] }) {
  return (
    <nav className="fil-ariane conteneur" aria-label="Fil d'Ariane">
      <ol>
        <li>
          <Link href="/">Accueil</Link>
        </li>
        {elements.map((e) => (
          <li key={e.libelle}>{e.href ? <Link href={e.href}>{e.libelle}</Link> : <span aria-current="page">{e.libelle}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

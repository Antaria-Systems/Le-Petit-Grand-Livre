"use client";

import { useEffect, useRef, useState } from "react";

/** Onglets de la fiche, qui suivent la section en cours de lecture. */
export function NavFiche({ sections }: { sections: { id: string; libelle: string }[] }) {
  const [actif, setActif] = useState(sections[0]?.id);
  const liste = useRef<HTMLUListElement>(null);

  // L'onglet actif reste visible dans la barre (sur mobile, elle défile horizontalement).
  useEffect(() => {
    const ul = liste.current;
    const a = ul?.querySelector<HTMLElement>(`a[href="#${actif}"]`);
    if (!ul || !a || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollTo({ left: a.offsetLeft - ul.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
  }, [actif]);

  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => e !== null);
    const visibles = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) visibles.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const premier = sections.find((s) => (visibles.get(s.id) ?? 0) > 0);
        if (premier) setActif(premier.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0, 0.01] },
    );
    elements.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav className="nav-fiche" aria-label="Sections de la fiche">
      <div className="conteneur">
        <ul ref={liste}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={actif === s.id ? "true" : undefined}>
                {s.libelle}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

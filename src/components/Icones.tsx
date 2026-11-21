type P = { taille?: number; className?: string };
const base = (t: number) => ({ width: t, height: t, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

/**
 * Logo : une page de grand livre comptable, réglée de lignes bleues avec sa marge rouge.
 * Les couleurs suivent le thème (variables --brand, --rouge).
 */
export const LogoRegistre = ({ taille = 44, className }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 44 44" aria-hidden className={className ?? "logo-registre"}>
    <rect width="44" height="44" rx="6" className="logo-fond" />
    <path d="M12 9h18.5a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H12Z" className="logo-page" />
    <path d="M12 9v26" className="logo-dos" />
    <path d="M15 16h14M15 21h14M15 26h14M15 31h9" className="logo-lignes" />
    <path d="M19 9v26" className="logo-marge" />
  </svg>
);

/** Ancienne icône (livre ouvert), conservée pour les usages compacts. */
export const IconeLogo = ({ taille = 18 }: P) => (
  <svg {...base(taille)} strokeWidth={2}>
    <path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.6v13.2c3.6 0 6.2.6 8 1.9 1.8-1.3 4.4-1.9 8-1.9V4.6c-3.6 0-6.2.6-8 1.9Z" />
    <path d="M12 6.5v13.2" />
  </svg>
);
export const IconeRecherche = ({ taille = 18, className }: P) => (
  <svg {...base(taille)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconeLune = ({ taille = 18 }: P) => (
  <svg {...base(taille)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);
export const IconeSoleil = ({ taille = 18 }: P) => (
  <svg {...base(taille)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconeDocument = ({ taille = 18 }: P) => (
  <svg {...base(taille)}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const IconeMenu = ({ taille = 20 }: P) => (
  <svg {...base(taille)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const IconeFermer = ({ taille = 20 }: P) => (
  <svg {...base(taille)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconeFleche = ({ taille = 20, className }: P) => (
  <svg {...base(taille)} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconeExterne = ({ taille = 14, className }: P) => (
  <svg {...base(taille)} className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconeInfo = ({ taille = 18, className }: P) => (
  <svg {...base(taille)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
);
export const IconeTelecharger = ({ taille = 16, className }: P) => (
  <svg {...base(taille)} className={className}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const IconeCourrier = ({ taille = 18, className }: P) => (
  <svg {...base(taille)} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

/*
 * Pictogrammes (64 px) : trait de la couleur de marque, un détail en rouge registre.
 * Dessinés pour la plateforme, purement décoratifs.
 */
const picto = { width: 64, height: 64, viewBox: "0 0 64 64", fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "picto" };

/** Des données publiques mises en forme : un registre et un graphique en barres. */
export const PictoDonnees = () => (
  <svg {...picto}>
    <rect x="10" y="8" width="36" height="46" rx="2" className="picto-fond" />
    <path d="M10 8h36v46H10z" className="picto-trait" />
    <path d="M17 8v46" className="picto-accent" />
    <path d="M23 44V34M30 44V26M37 44V30" className="picto-trait" strokeWidth={4} />
    <path d="M22 18h17" className="picto-trait" />
    <circle cx="48" cy="46" r="9" className="picto-fond-blanc picto-trait" />
    <path d="m54.5 52.5 4 4" className="picto-trait" strokeWidth={3} />
  </svg>
);

/** Une demande écrite à la mairie. */
export const PictoCourrier = () => (
  <svg {...picto}>
    <path d="M16 10h26l8 8v20H16z" className="picto-fond picto-trait" />
    <path d="M42 10v8h8" className="picto-trait" />
    <path d="M22 20h12M22 26h20M22 32h16" className="picto-trait" />
    <rect x="8" y="34" width="44" height="22" rx="2" className="picto-fond-blanc picto-trait" />
    <path d="m9 36 21 14 21-14" className="picto-trait" />
    <circle cx="52" cy="36" r="6" className="picto-pastille" />
  </svg>
);

/** Un document dont les mentions protégées sont masquées. */
export const PictoOccultation = () => (
  <svg {...picto}>
    <path d="M12 8h28l10 10v38H12z" className="picto-fond picto-trait" />
    <path d="M40 8v10h10" className="picto-trait" />
    <path d="M18 24h14" className="picto-trait" />
    <path d="M18 31h26" className="picto-masque" strokeWidth={5} />
    <path d="M18 39h10" className="picto-trait" />
    <path d="M32 39h12" className="picto-masque" strokeWidth={5} />
    <path d="M18 47h20" className="picto-trait" />
    <path d="M36 44c4 1 8 0 12-3" className="picto-accent" />
  </svg>
);

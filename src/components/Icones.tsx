type P = { taille?: number; className?: string };
const base = (t: number) => ({ width: t, height: t, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconeLogo = ({ taille = 18 }: P) => (
  <svg {...base(taille)} strokeWidth={2.4}>
    <path d="M6 18v-5M12 18V8M18 18V5" />
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

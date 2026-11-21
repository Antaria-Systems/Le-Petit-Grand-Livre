/** Logo pour les images générées (ImageResponse) : couleurs en attributs, pas de CSS. */
export function LogoOg({ taille }: { taille: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 44 44">
      <rect width="44" height="44" rx="6" fill="#1b3d8f" />
      <path d="M12 9h18.5a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H12Z" fill="#ffffff" />
      <path d="M12 9v26" stroke="#0f255c" strokeWidth="2" />
      <path d="M15 16h14M15 21h14M15 26h14M15 31h9" stroke="#9fb3e0" strokeWidth="1.6" />
      <path d="M19 9v26" stroke="#d6434d" strokeWidth="1.6" />
    </svg>
  );
}

/** Mise en page commune aux images de partage : page de registre, marge rouge. */
export function CarteOg({
  site,
  titre,
  soustitre,
  pied,
  chiffres = [],
}: {
  site: string;
  titre: string;
  soustitre: string;
  pied: string;
  chiffres?: { valeur: string; libelle: string }[];
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f4f6fb",
        padding: "56px 72px 48px 128px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", left: 84, top: 0, bottom: 0, width: 3, background: "#c62f3a", display: "flex" }} />
      <div style={{ position: "absolute", left: 91, top: 0, bottom: 0, width: 1, background: "#c62f3a", display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <LogoOg taille={72} />
        <div style={{ fontSize: 30, fontWeight: 700, color: "#1b3d8f" }}>{site}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: titre.length > 24 ? 64 : 80, fontWeight: 800, color: "#161a22", lineHeight: 1.05 }}>{titre}</div>
        <div style={{ fontSize: 34, color: "#3b4250" }}>{soustitre}</div>
        {chiffres.length > 0 && (
          <div style={{ display: "flex", gap: 48, marginTop: 16 }}>
            {chiffres.map((c) => (
              <div key={c.libelle} style={{ display: "flex", flexDirection: "column", borderLeft: "4px solid #1b3d8f", paddingLeft: 16 }}>
                <div style={{ fontSize: 44, fontWeight: 800, color: "#1b3d8f" }}>{c.valeur}</div>
                <div style={{ fontSize: 24, color: "#3b4250" }}>{c.libelle}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, color: "#5d6573" }}>{pied}</div>
    </div>
  );
}

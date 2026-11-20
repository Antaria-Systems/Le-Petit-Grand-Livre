export function EnTeteSection({
  id,
  surtitre,
  titre,
  description,
  children,
}: {
  id: string;
  surtitre: string;
  titre: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="section-entete">
      <div>
        <p className="surtitre">{surtitre}</p>
        <h2 id={id}>{titre}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {children && <div className="section-actions">{children}</div>}
    </header>
  );
}

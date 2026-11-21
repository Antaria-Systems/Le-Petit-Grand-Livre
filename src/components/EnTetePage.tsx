import { FilAriane, type Etape } from "./FilAriane";

/** Bandeau de titre des pages : fil d'Ariane, surtitre, titre, chapô ; colonne latérale facultative. */
export function EnTetePage({
  ariane,
  surtitre,
  titre,
  chapo,
  children,
  cote,
}: {
  ariane: Etape[];
  surtitre?: React.ReactNode;
  titre: React.ReactNode;
  chapo?: React.ReactNode;
  children?: React.ReactNode;
  cote?: React.ReactNode;
}) {
  return (
    <div className="page-entete">
      <div className="conteneur">
        <FilAriane elements={ariane} />
        <div className={cote ? "page-entete-grille" : undefined}>
          <div>
            {surtitre && <p className="surtitre">{surtitre}</p>}
            <h1>{titre}</h1>
            {chapo && <p className="chapo">{chapo}</p>}
            {children}
          </div>
          {cote && <div className="page-entete-cote">{cote}</div>}
        </div>
      </div>
    </div>
  );
}

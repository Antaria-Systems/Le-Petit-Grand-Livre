import { site } from "@/lib/config";
import { urlAbsolue } from "@/lib/seo";

export const dynamic = "force-dynamic";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * Description OpenSearch : permet d'ajouter la recherche de communes aux moteurs du navigateur
 * (Firefox, Chrome : taper l'adresse du site puis Tab). Nom court : 16 caractères au plus.
 */
export function GET() {
  const nomCourt = site.nom.length <= 16 ? site.nom : "LPGL";
  const corps = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>${xml(nomCourt)}</ShortName>
  <LongName>${xml(site.nom)}</LongName>
  <Description>${xml(`Rechercher une commune sur ${site.nom} : budget, dette, travaux et documents`)}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Language>fr-FR</Language>
  <Image width="64" height="64" type="image/svg+xml">${xml(urlAbsolue("/icon.svg"))}</Image>
  <Url type="text/html" method="get" template="${xml(urlAbsolue("/recherche"))}?q={searchTerms}"/>
  <moz:SearchForm>${xml(urlAbsolue("/recherche"))}</moz:SearchForm>
</OpenSearchDescription>
`;
  return new Response(corps, {
    headers: { "Content-Type": "application/opensearchdescription+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}

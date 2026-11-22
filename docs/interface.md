# Interface et accessibilité

L'identité visuelle de la plateforme, ses composants, ses graphiques, et ce qui est fait pour l'accessibilité et le référencement.

← [Retour au README](../README.md)

---

## Sommaire

1. [Identité visuelle](#1-identité-visuelle)
2. [Couleurs et thèmes](#2-couleurs-et-thèmes)
3. [Typographie et rédaction](#3-typographie-et-rédaction)
4. [Composants](#4-composants)
5. [Graphiques](#5-graphiques)
6. [Accessibilité](#6-accessibilité)
7. [Mobile](#7-mobile)
8. [Référencement et partage](#8-référencement-et-partage)
9. [Où modifier quoi](#9-où-modifier-quoi)

---

## 1. Identité visuelle

![Accueil](images/accueil.png)

L'interface s'inspire des **conventions des services publics numériques** (en-tête sobre, fil d'Ariane, tuiles, encarts, formulaires lisibles), sans reprendre le système de design de l'État (DSFR), sa police Marianne ni son bloc-marque, réservés aux sites de l'État. L'identité est propre à l'association :

- **le grand livre** : le logo représente une page de registre comptable (lignes bleues, marge rouge) ; le même motif (lignes horizontales et double marge rouge) habille le bandeau de l'accueil et l'en-tête des fiches ;
- **le bleu registre** `#1b3d8f`, distinct du bleu de l'État ;
- la mention **« Plateforme associative indépendante »** dans l'en-tête.

---

## 2. Couleurs et thèmes

Les couleurs sont des variables CSS (`src/app/globals.css`) :

| Variable | Clair | Usage |
|---|---|---|
| `--brand` | `#1b3d8f` | Liens, boutons principaux, éléments actifs |
| `--brand-hover`, `--brand-active` | `#142f73`, `#0f255c` | États des boutons |
| `--rouge` | `#c62f3a` | Marge du registre, repère sur les cartes |
| `--ink` | `#161a22` | Texte principal |
| `--muted` | `#5d6573` | Texte secondaire |
| `--line`, `--line-strong` | `#dfe3ea`, `#b9c0cc` | Filets, bordures |
| `--champ-bg` | `#eef0f4` | Fond des champs de saisie (avec un trait inférieur) |
| `--focus` | `#0a6cdb` | Contour de focus (2 px) |
| `--admin-bg` | `#13265a` | Barre de l'administration |

**Thème sombre** : suit le réglage du système (`prefers-color-scheme`) ou le choix du visiteur (bouton « Thème sombre / clair », mémorisé dans le navigateur, appliqué avant l'affichage pour éviter un flash). Chaque variable a sa valeur sombre (par exemple `--brand` devient `#8fa9f5`).

![Fiche en thème sombre](images/fiche-sombre.png)

---

## 3. Typographie et rédaction

- **Police** : Public Sans (licence SIL OFL), auto-hébergée par `next/font`, chargée en `display: swap`.
- **Hiérarchie** : un seul `h1` par page, titres de section avec surtitre en petites capitales.
- **Chiffres** : chiffres tabulaires (`.chiffres`) dans les tableaux et tuiles.
- **Typographie française** : espaces insécables avant `: ; ? !` et dans les nombres (« 1 612 hab. », « 55,7 % »), guillemets « », accords au singulier sous 2 (« 1,9 année »), élisions (« de l'Aude », « d'Aigues-Vives »).
- **Ton** : langage courant, phrases courtes, sigles développés à leur première apparition ou dans une infobulle (`<abbr>`), aucun qualificatif de jugement sur les chiffres.

---

## 4. Composants

| Composant | Fichier | Rôle |
|---|---|---|
| En-tête | `components/EnteteSite.tsx`, `Entete.tsx` | Marque, devise, thème, recherche, navigation ; menu plein écran sous 992 px ; liens d'évitement. |
| Pied de page | `components/Pied.tsx` | Colonnes de liens, mention d'indépendance, sources, licences, code source. |
| Recherche | `components/RechercheCommune.tsx` | Combobox ARIA (flèches, Entrée, Échap), variantes « grande » et « compacte », repli sans JavaScript vers `/recherche`. |
| En-tête de page | `components/EnTetePage.tsx`, `FilAriane.tsx` | Bandeau, fil d'Ariane, chapô, visuel latéral (carte). |
| Fiche commune | `components/fiche/*` | En-tête, barre d'onglets qui suit la lecture, sections, bibliothèque de documents, chantiers. |
| Filtre des communes | `components/FiltreCommunes.tsx` | Filtre instantané (rendu différé), index alphabétique. |
| Administration | `components/admin/*` | Formulaires reliés aux actions serveur (confirmation par bouton), éditeur d'occultation, dépôt, recherche Ctrl+K. |
| Images de partage | `components/og/LogoOg.tsx`, `app/opengraph-image.tsx` | Carte 1200 × 630 générée. |

Éléments génériques (classes CSS) : `.bouton`, `.bouton-principal`, `.carte`, `.tuile`, `.encart`, `.badge` (statuts toujours accompagnés d'un libellé), `.alerte-{info,attention,urgent}`, `.champ`, `.vide` (états vides explicites).

---

## 5. Graphiques

Les graphiques sont des composants SVG maison (`components/graphiques/`), sans bibliothèque :

| Graphique | Usage |
|---|---|
| `BarreSegmentee` | Composition des recettes et des dépenses (parts). |
| `GraphiqueLignes` | Évolution des recettes et dépenses de fonctionnement ; navigation au clavier (← →), infobulle annoncée. |
| `GraphiqueColonnes` | Investissement, dette par habitant ; étiquettes positionnées pour ne pas chevaucher les colonnes voisines. |

Règles :

- palette de séries **vérifiée pour les daltonismes** et pour les deux thèmes ;
- pourcentages écrits dans les parts sur une **pastille claire**, lisibles quelle que soit la couleur ;
- écarts à la médiane en **deux teintes neutres** (bleu au-dessus, gris-bleu en dessous), jamais rouge et vert ;
- chaque graphique a une **alternative** : un résumé pour les lecteurs d'écran (`role="img"` + `aria-label`) et un tableau « Voir les données » ;
- largeur mesurée côté client ; avant cela, le SVG se réduit (`viewBox`) au lieu de déborder.

![Budget](images/fiche-budget.png)

---

## 6. Accessibilité

Référentiel visé : **RGAA 4.1 / WCAG 2.2 niveau AA**.

| Thème | Ce qui est fait |
|---|---|
| Structure | `lang="fr"`, repères (`header`, `nav`, `main`, `footer`) nommés, titres hiérarchisés, titres de page uniques (404 comprise). |
| Clavier | Liens d'évitement (Contenu, Menu, Pied de page), focus visible partout (2 px), ordre logique ; menu mobile **modal** (focus gardé dans le menu, reste de la page inerte, Échap) ; éditeur d'occultation entièrement au clavier. |
| Lecteurs d'écran | Combobox ARIA, `aria-live` sur les compteurs, graphiques résumés, liens PDF annoncés (« PDF, 2 pages »), liens externes annoncés (« nouvel onglet »), tableaux avec en-têtes de ligne et légendes. |
| Contrastes | Textes de 4,8:1 à 17:1 dans les deux thèmes ; traits de champs contrastés. |
| Texte agrandi et zoom | Grilles en `rem`, coupure des mots longs, aucune hauteur fixe sur les éléments de texte ; pas de défilement horizontal de 320 à 1440 px. |
| Couleurs forcées (Windows) | Contours de champs et états actifs conservés (`@media (forced-colors: active)`). |
| Mouvement | `prefers-reduced-motion` respecté. |
| Sans JavaScript | Recherche et navigation mobile utilisables. |

---

## 7. Mobile

| Fiche | L'essentiel | Menu |
|---|---|---|
| ![Fiche sur mobile](images/mobile-fiche.png) | ![L'essentiel sur mobile](images/mobile-essentiel.png) | ![Menu mobile](images/mobile-menu.png) |

- Menu plein écran sous 992 px ; recherche intégrée.
- Barre d'onglets de la fiche défilante, avec un fondu qui signale la suite, et qui garde l'onglet actif visible.
- Tableau de comparaison présenté en cartes sous 600 px.
- Les 5 premiers chantiers dépliés, les autres sur demande.

---

## 8. Référencement et partage

- **Titres et descriptions** propres à chaque page (« Lavalette (11) : budget, travaux, documents », « Communes de l'Aude (11) : finances et documents »).
- **Adresses canoniques** sur toutes les pages ; `?annee=` neutralisé sur les fiches.
- **`/sitemap.xml`** : pages fixes, territoires couverts, toutes les fiches des départements couverts (date de dernière publication).
- **`/robots.txt`** : administration, API, connexion et recherche exclues.
- **Pages non couvertes** (département ou région sans couverture) en `noindex`.
- **Images de partage** : une image par défaut et une par fiche (nom, département, population, dette par habitant, documents publiés).

  <img src="images/partage-fiche.png" alt="Image de partage d'une fiche" width="480">

- **Icônes** : `icon.svg`, icône Apple 180 px, manifeste web.

---

## 9. Où modifier quoi

| Je veux changer… | Fichier |
|---|---|
| Une couleur, un espacement, un composant visuel | `src/app/globals.css` |
| Le logo | `src/components/Icones.tsx` (`LogoRegistre`), `src/app/icon.svg`, `src/components/og/LogoOg.tsx` |
| L'en-tête, le menu, le pied de page | `src/components/EnteteSite.tsx`, `src/components/Pied.tsx` |
| Un texte de l'accueil, de la méthodologie, des mentions | `src/app/(site)/page.tsx`, `methodologie/page.tsx`, `mentions-legales/page.tsx` |
| Les phrases de « L'essentiel » | `src/lib/resume.ts` |
| Un graphique | `src/components/graphiques/` |
| Le barème des indemnités | `src/components/fiche/SectionElus.tsx` |
| Les images de partage | `src/app/opengraph-image.tsx`, `src/app/(site)/communes/[slug]/opengraph-image.tsx` |

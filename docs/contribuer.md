# Contribuer

Comment proposer une amélioration ou une correction, et les conventions du projet.

← [Retour au README](../README.md)

---

## Avant de commencer

- **Une erreur sur une fiche, une mention à masquer** : écrivez à contact.lpgl@antaria-systems.fr plutôt que d'ouvrir une issue.
- **Une faille de sécurité** : voir [SECURITY.md](../SECURITY.md), pas d'issue publique.
- **Une idée, un bogue** : ouvrez une issue sur GitHub, en décrivant le comportement attendu et observé.

## Mettre en place l'environnement

Voir [installation.md](installation.md#3-développement-local). En résumé : Node.js 24, Docker pour PostgreSQL, `npm ci`, migrations, imports, puis `npm run dev` avec `ADMIN_BASIC=1`.

> N'utilisez jamais un vrai relais SMTP en développement : `SMTP_HOST=smtp.invalid`. Les tests d'envoi utilisent un transport factice.

## Conventions

- **Langue** : le code métier, les commentaires, les messages et l'interface sont en **français** (noms de variables compris : `commune`, `demande`, `occultation`…). Les termes techniques des bibliothèques restent en anglais.
- **TypeScript strict**, sans `any` inutile ; validation des entrées avec **zod** dans les actions serveur et les routes API.
- **Accès** : toute nouvelle page d'administration appelle `verifierAdminPage()`, toute action serveur passe par `exigerAdmin()` (ou l'enveloppe `action()` de `actions.ts`), toute route API par `refusAdmin()`.
- **Données personnelles** : aucune requête publique ne doit renvoyer de champ interne ; utilisez des `select` explicites.
- **Dates** : toute date affichée ou saisie est en **heure de Paris** (`src/lib/heure.ts`, `formatJourParis`) ; les conteneurs sont en UTC.
- **Montants** : lisez les saisies avec `lireMontant()` ; jamais de conversion silencieuse en `null`.
- **Base de données** : toute évolution du schéma passe par une migration (`npx prisma migrate dev --name …`) ; vérifiez qu'il n'y a pas d'écart (`prisma migrate diff`).
- **Interface** : réutilisez les classes et variables de `globals.css` ; vérifiez le thème sombre, le mobile (320 px), le clavier et le texte agrandi.
- **Typographie** : espaces insécables avant `: ; ? !` (`&nbsp;` dans le JSX), guillemets « ».
- **Mise en forme** : suivez le style des fichiers existants (indentation de 2 espaces, guillemets doubles, points-virgules, lignes de 140 caractères au plus).

## Tests

```sh
npm run typecheck
npm test
TEST_DATABASE_URL=postgresql://… npm test    # base jetable : les tests créent et suppriment leurs données
```

Ajoutez un test pour toute règle métier sensible : délais, montants, envois, occultation.

## Commits et revue

- Un commit par changement cohérent, message en français à l'impératif ou au nominal (« Demandes : envoi programmé à une date et une heure »), avec une liste des changements importants dans le corps.
- Les migrations, les changements de sécurité et ceux qui touchent aux envois ou à la publication sont relus avec une attention particulière.
- Le code est publié sous **AGPL-3.0** : en contribuant, vous acceptez que votre contribution le soit aussi.

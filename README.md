# Plateforme d'open data des finances communales

Budgets, indemnités des élus (par fonction), travaux et documents administratifs des communes,
obtenus au titre du droit d'accès aux documents administratifs (CRPA, art. L.311-1) et rendus lisibles.

- **Code** : GNU AGPL-3.0 · **Données publiées** : Licence Ouverte 2.0
- **Stack** : Next.js 16 · React 19 · Prisma 7 · PostgreSQL 17 · Docker

## Sources open data

| Donnée | Source |
|---|---|
| Comptes des communes (agrégats, 2018 →) | OFGL, jeu `ofgl-base-communes` |
| Médianes nationales par strate de population | OFGL (calculées via l'API) |
| Régions, départements, communes | geo.api.gouv.fr |
| Coordonnées des mairies | Annuaire de l'administration (service-public.fr) |

## Démarrage (développement)

```sh
cp .env.example .env            # puis remplir les valeurs (ORIGINALS_KEY : openssl rand -hex 32)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npx prisma migrate deploy
npm run import:all              # ~2 min pour l'Aude
npm run dev
```

## Production

```sh
docker compose build
docker compose run --rm tools npx prisma migrate deploy
docker compose run --rm tools npm run import:all
docker compose up -d app        # écoute sur 10.1.0.2:8087
```

La base de données est sur un réseau Docker interne, sans accès à Internet.

## Documents et occultation

- L'original reçu de la mairie est **chiffré** (AES-256-GCM, clé `ORIGINALS_KEY`) dans `storage/originaux/`
  et n'est jamais servi publiquement. **Sauvegardez la clé hors du serveur** : sans elle, les originaux sont perdus.
- La version publique est rastérisée, les zones occultées sont noircies, puis le PDF est reconstruit :
  aucun texte ne subsiste sous les masques.
- Les élus sont publiés **par fonction**, jamais par nom.

## Structure

```
prisma/schema.prisma        modèle de données (référentiel, finances, documents, demandes)
scripts/import-*.ts         imports open data
src/app/                    pages (accueil, région, département, commune, méthodologie…)
src/components/graphiques/  graphiques SVG accessibles (survol, clavier, tableau de données)
src/lib/                    accès aux données, formatage, stockage chiffré
```

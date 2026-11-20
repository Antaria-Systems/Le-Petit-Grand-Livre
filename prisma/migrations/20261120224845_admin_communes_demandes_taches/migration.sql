CREATE TYPE "TypeTache" AS ENUM ('IMPORTER_DEPARTEMENT');

CREATE TYPE "StatutTache" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ERREUR');

-- AlterTable
ALTER TABLE "Commune" ADD COLUMN     "notesInternes" TEXT,
ADD COLUMN     "presentation" TEXT;

-- AlterTable
ALTER TABLE "Demande" ADD COLUMN     "avisCada" TEXT,
ADD COLUMN     "avisCadaLe" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reponseLe" TIMESTAMP(3);

CREATE TABLE "Tache" (
    "id" SERIAL NOT NULL,
    "type" "TypeTache" NOT NULL,
    "parametre" TEXT NOT NULL,
    "statut" "StatutTache" NOT NULL DEFAULT 'EN_ATTENTE',
    "journal" TEXT NOT NULL DEFAULT '',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debutLe" TIMESTAMP(3),
    "finLe" TIMESTAMP(3),

    CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Tache_statut_idx" ON "Tache"("statut");


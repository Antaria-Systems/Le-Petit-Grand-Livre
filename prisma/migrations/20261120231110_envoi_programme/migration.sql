-- AlterTable
ALTER TABLE "Demande" ADD COLUMN     "envoiCopieCachee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "envoiProgrammeLe" TIMESTAMP(3),
ADD COLUMN     "erreurEnvoi" TEXT;

CREATE INDEX "Demande_envoiProgrammeLe_idx" ON "Demande"("envoiProgrammeLe");


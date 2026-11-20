-- DropForeignKey
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_documentId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "copie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entreprise" TEXT,
ADD COLUMN     "montantHT" DECIMAL(14,2),
ADD COLUMN     "montantTTC" DECIMAL(14,2),
ADD COLUMN     "objet" TEXT,
ADD COLUMN     "operationId" INTEGER;

-- AlterTable
ALTER TABLE "Operation" DROP COLUMN "documentId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "lieu" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL;

CREATE UNIQUE INDEX "Operation_communeCode_slug_key" ON "Operation"("communeCode", "slug");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;


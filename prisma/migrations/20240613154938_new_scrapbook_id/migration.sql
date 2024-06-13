/*
  Warnings:

  - The primary key for the `Scrapbook` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `menuTs` on the `Scrapbook` table. All the data in the column will be lost.
  - You are about to drop the column `scrapbookTs` on the `Session` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[scrapbookId]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `channel` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `internalId` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_scrapbookTs_fkey";

-- AlterTable
ALTER TABLE "Scrapbook" DROP CONSTRAINT "Scrapbook_pkey",
DROP COLUMN "menuTs",
ADD COLUMN     "channel" TEXT NOT NULL,
ADD COLUMN     "internalId" TEXT NOT NULL,
ADD CONSTRAINT "Scrapbook_pkey" PRIMARY KEY ("internalId");

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "scrapbookTs",
ADD COLUMN     "scrapbookId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_scrapbookId_key" ON "Session"("scrapbookId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_scrapbookId_fkey" FOREIGN KEY ("scrapbookId") REFERENCES "Scrapbook"("internalId") ON DELETE SET NULL ON UPDATE CASCADE;

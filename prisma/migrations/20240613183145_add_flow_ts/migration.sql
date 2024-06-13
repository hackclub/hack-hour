/*
  Warnings:

  - A unique constraint covering the columns `[flowTs]` on the table `Scrapbook` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `flowTs` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Scrapbook" ADD COLUMN     "flowTs" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Scrapbook_flowTs_key" ON "Scrapbook"("flowTs");

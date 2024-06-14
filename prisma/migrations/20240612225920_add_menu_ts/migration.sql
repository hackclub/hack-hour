/*
  Warnings:

  - Added the required column `menuTs` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Scrapbook" ADD COLUMN     "menuTs" TEXT NOT NULL;

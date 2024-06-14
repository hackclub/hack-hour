/*
  Warnings:

  - Added the required column `data` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Scrapbook" ADD COLUMN     "data" JSONB NOT NULL;

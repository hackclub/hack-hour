/*
  Warnings:

  - Added the required column `flowChannel` to the `Scrapbook` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Scrapbook" ADD COLUMN     "flowChannel" TEXT NOT NULL;

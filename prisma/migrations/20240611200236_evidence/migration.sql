/*
  Warnings:

  - You are about to drop the column `minutes` on the `Log` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Log" DROP COLUMN "minutes";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "evidence" BOOLEAN NOT NULL DEFAULT false;

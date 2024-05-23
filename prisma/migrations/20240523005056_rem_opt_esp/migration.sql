/*
  Warnings:

  - Made the column `elapsedSincePause` on table `Session` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "elapsedSincePause" SET NOT NULL;

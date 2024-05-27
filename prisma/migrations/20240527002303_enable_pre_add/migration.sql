/*
  Warnings:

  - Added the required column `verified` to the `VerifiedSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VerifiedSession" ADD COLUMN     "verified" BOOLEAN NOT NULL;

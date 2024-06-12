/*
  Warnings:

  - You are about to drop the column `totalMinutes` on the `Goal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "totalMinutes",
ADD COLUMN     "minutes" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

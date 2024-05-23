/*
  Warnings:

  - The primary key for the `Installation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[userId]` on the table `Installation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `installation` to the `Installation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamId` to the `Installation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Installation" DROP CONSTRAINT "Installation_pkey",
ADD COLUMN     "installation" JSONB NOT NULL,
ADD COLUMN     "teamId" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "Installation_pkey" PRIMARY KEY ("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_userId_key" ON "Installation"("userId");

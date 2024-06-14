/*
  Warnings:

  - Made the column `goalId` on table `Session` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `data` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_goalId_fkey";

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "goalId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "data" JSONB NOT NULL;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

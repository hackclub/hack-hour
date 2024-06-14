/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_transactionId_key" ON "Session"("transactionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

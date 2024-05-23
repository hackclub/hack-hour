/*
  Warnings:

  - A unique constraint covering the columns `[controlTs]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Session_controlTs_key" ON "Session"("controlTs");

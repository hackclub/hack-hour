/*
  Warnings:

  - You are about to drop the column `slackToken` on the `SlackUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SlackUser" DROP COLUMN "slackToken";

-- CreateTable
CREATE TABLE "Installation" (
    "slackId" TEXT NOT NULL,
    "slackToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SlackUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

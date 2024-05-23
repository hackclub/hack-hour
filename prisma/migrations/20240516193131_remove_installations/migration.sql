/*
  Warnings:

  - You are about to drop the `Installation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Installation" DROP CONSTRAINT "Installation_userId_fkey";

-- AlterTable
ALTER TABLE "SlackUser" ADD COLUMN     "slackToken" TEXT;

-- DropTable
DROP TABLE "Installation";

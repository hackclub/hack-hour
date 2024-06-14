/*
  Warnings:

  - You are about to drop the column `selected` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `slackToken` on the `SlackUser` table. All the data in the column will be lost.
  - You are about to drop the column `tz_offset` on the `SlackUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "selected",
ADD COLUMN     "default" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SlackUser" DROP COLUMN "slackToken",
DROP COLUMN "tz_offset";

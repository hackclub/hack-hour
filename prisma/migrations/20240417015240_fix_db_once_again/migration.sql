/*
  Warnings:

  - You are about to drop the column `selectedGoal` on the `User` table. All the data in the column will be lost.
  - Added the required column `defaultGoal` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "slackId" TEXT NOT NULL PRIMARY KEY,
    "totalMinutes" INTEGER NOT NULL,
    "tz" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL,
    "reminder" TEXT NOT NULL,
    "defaultGoal" TEXT NOT NULL,
    "eventId" TEXT
);
INSERT INTO "new_User" ("eventId", "reminder", "remindersEnabled", "slackId", "totalMinutes", "tz") SELECT "eventId", "reminder", "remindersEnabled", "slackId", "totalMinutes", "tz" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

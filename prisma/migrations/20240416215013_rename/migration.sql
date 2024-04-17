-- Rename the column
ALTER TABLE "User" RENAME COLUMN "defaultGoal" TO "selectedGoal";
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "slackId" TEXT NOT NULL PRIMARY KEY,
    "totalMinutes" INTEGER NOT NULL,
    "tz" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL,
    "reminder" TEXT NOT NULL,
    "selectedGoal" TEXT NOT NULL,
    "eventId" TEXT
);
INSERT INTO "new_User" ("eventId", "reminder", "remindersEnabled", "slackId", "totalMinutes", "tz", "selectedGoal") SELECT "eventId", "reminder", "remindersEnabled", "slackId", "totalMinutes", "tz", "selectedGoal" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

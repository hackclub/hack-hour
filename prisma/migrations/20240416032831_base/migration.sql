-- CreateTable
CREATE TABLE "User" (
    "slackId" TEXT NOT NULL PRIMARY KEY,
    "totalMinutes" INTEGER NOT NULL,
    "tz" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL,
    "reminder" TEXT NOT NULL,
    "defaultGoal" TEXT NOT NULL,
    "eventId" TEXT
);

-- CreateTable
CREATE TABLE "Session" (
    "messageTs" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "elapsed" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "attachment" TEXT,
    "cancelled" BOOLEAN NOT NULL,
    "createdAt" TEXT
);

-- CreateTable
CREATE TABLE "Goals" (
    "goalId" TEXT NOT NULL PRIMARY KEY,
    "slackId" TEXT NOT NULL,
    "goalName" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    CONSTRAINT "Goals_slackId_fkey" FOREIGN KEY ("slackId") REFERENCES "User" ("slackId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventContributions" (
    "contributionId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slackId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "sessions" TEXT NOT NULL
);

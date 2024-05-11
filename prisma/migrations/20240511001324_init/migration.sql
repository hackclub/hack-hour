-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "lifetimeMinutes" INTEGER NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackUser" (
    "slackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tz_offset" INTEGER NOT NULL,

    CONSTRAINT "SlackUser_pkey" PRIMARY KEY ("slackId")
);

-- CreateTable
CREATE TABLE "Session" (
    "userId" TEXT NOT NULL,
    "messageTs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "time" INTEGER NOT NULL,
    "elapsed" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "cancelled" BOOLEAN NOT NULL,
    "paused" BOOLEAN NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("messageTs")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackUser_userId_key" ON "SlackUser"("userId");

-- AddForeignKey
ALTER TABLE "SlackUser" ADD CONSTRAINT "SlackUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

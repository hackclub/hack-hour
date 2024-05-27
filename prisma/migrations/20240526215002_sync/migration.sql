-- CreateTable
CREATE TABLE "VerifiedSession" (
    "sessionId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "VerifiedSession_pkey" PRIMARY KEY ("sessionId")
);

-- AddForeignKey
ALTER TABLE "VerifiedSession" ADD CONSTRAINT "VerifiedSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("messageTs") ON DELETE RESTRICT ON UPDATE CASCADE;

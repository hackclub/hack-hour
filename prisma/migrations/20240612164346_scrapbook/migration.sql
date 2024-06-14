-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "scrapbookTs" TEXT;

-- CreateTable
CREATE TABLE "Scrapbook" (
    "ts" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Scrapbook_pkey" PRIMARY KEY ("ts")
);

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_scrapbookTs_fkey" FOREIGN KEY ("scrapbookTs") REFERENCES "Scrapbook"("ts") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrapbook" ADD CONSTRAINT "Scrapbook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

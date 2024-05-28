-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "maxAttachmentChars" INTEGER NOT NULL DEFAULT 25000,
ADD COLUMN     "maxFileBytes" INTEGER NOT NULL DEFAULT 1048576;

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_eventId_key" ON "stripe_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_events_eventType_receivedAt_idx" ON "stripe_events"("eventType", "receivedAt");

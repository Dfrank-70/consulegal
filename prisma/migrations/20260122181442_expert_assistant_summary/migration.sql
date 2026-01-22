-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "expertSummary" JSONB,
ADD COLUMN     "expertSummaryCreatedAt" TIMESTAMP(3),
ADD COLUMN     "expertSummaryModel" TEXT,
ADD COLUMN     "expertSummaryProvider" TEXT;

-- CreateTable
CREATE TABLE "ExpertAssistantConfig" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "customInstruction" TEXT NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertAssistantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertAssistantConfig_isActive_idx" ON "ExpertAssistantConfig"("isActive");

/*
  Warnings:

  - Added the required column `updatedAt` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Step 1: Add the column with a temporary default value to satisfy NOT NULL constraint
ALTER TABLE "Conversation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Backfill the new column with the values from createdAt for historical accuracy
UPDATE "Conversation" SET "updatedAt" = "createdAt";

-- Step 3: Remove the temporary default value
ALTER TABLE "Conversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

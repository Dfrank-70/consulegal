-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultExpertId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultExpertId_fkey" FOREIGN KEY ("defaultExpertId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

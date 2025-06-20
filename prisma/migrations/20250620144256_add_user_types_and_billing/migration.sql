-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('PRIVATE', 'COMPANY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "sdiCode" TEXT,
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "vatNumber" TEXT;

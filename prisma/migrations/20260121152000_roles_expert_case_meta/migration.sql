-- Roles: rename CLIENT -> CUSTOMER and add EXPERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'CLIENT'
  ) THEN
    EXECUTE 'ALTER TYPE "Role" RENAME VALUE ''CLIENT'' TO ''CUSTOMER''';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'EXPERT'
  ) THEN
    EXECUTE 'ALTER TYPE "Role" ADD VALUE ''EXPERT''';
  END IF;
END$$;

-- Message: add meta JSONB
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "meta" JSONB;

-- Case: add assignedToId + FK + index
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Case_assignedToId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Case_assignedToId_idx" ON "Case"("assignedToId");

-- CreateTable
CREATE TABLE "WorkflowExecutionLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "error" TEXT,
    "steps" JSONB,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

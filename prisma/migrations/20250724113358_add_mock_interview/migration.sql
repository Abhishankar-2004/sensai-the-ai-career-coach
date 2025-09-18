-- CreateTable
CREATE TABLE "MockInterview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT,
    "questionCount" INTEGER NOT NULL DEFAULT 5,
    "questionTypes" TEXT[],
    "questions" JSONB[],
    "responses" JSONB[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION,
    "overallFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockInterview_userId_idx" ON "MockInterview"("userId");

-- CreateIndex
CREATE INDEX "MockInterview_status_idx" ON "MockInterview"("status");

-- AddForeignKey
ALTER TABLE "MockInterview" ADD CONSTRAINT "MockInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

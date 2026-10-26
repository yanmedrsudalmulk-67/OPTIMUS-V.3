-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 20,
    "points" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "QuestionPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "modelPath" TEXT,
    "thumbnailPath" TEXT,
    "animationConfig" JSONB NOT NULL DEFAULT '{}' ,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "packageId" TEXT,
    "packageName" TEXT NOT NULL,
    "teamAName" TEXT NOT NULL DEFAULT 'Tim Emerald',
    "teamBName" TEXT NOT NULL DEFAULT 'Tim Sapphire',
    "phase" TEXT NOT NULL DEFAULT 'WAITING',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}' ,
    "snapshots" JSONB NOT NULL DEFAULT '[]' ,
    "ropePosition" REAL NOT NULL DEFAULT 0,
    "winner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Match_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "QuestionPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "power" REAL NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchPlayer_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "sourceQuestionId" TEXT,
    "snapshot" JSONB NOT NULL,
    "questionOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "deadlineAt" DATETIME,
    CONSTRAINT "MatchQuestion_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchQuestion_sourceQuestionId_fkey" FOREIGN KEY ("sourceQuestionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "matchQuestionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "selectedAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "powerAwarded" REAL NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerAnswer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerAnswer_matchQuestionId_fkey" FOREIGN KEY ("matchQuestionId") REFERENCES "MatchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "MatchPlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "matchQuestionId" TEXT NOT NULL,
    "teamAPower" REAL NOT NULL,
    "teamBPower" REAL NOT NULL,
    "ropeBefore" REAL NOT NULL,
    "ropeAfter" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchRound_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRound_matchQuestionId_fkey" FOREIGN KEY ("matchQuestionId") REFERENCES "MatchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "Question_packageId_active_sortOrder_idx" ON "Question"("packageId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Match_code_key" ON "Match"("code");

-- CreateIndex
CREATE INDEX "Match_phase_createdAt_idx" ON "Match"("phase", "createdAt");

-- CreateIndex
CREATE INDEX "Match_finishedAt_idx" ON "Match"("finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_sessionHash_key" ON "MatchPlayer"("sessionHash");

-- CreateIndex
CREATE INDEX "MatchPlayer_matchId_team_idx" ON "MatchPlayer"("matchId", "team");

-- CreateIndex
CREATE UNIQUE INDEX "MatchQuestion_matchId_questionOrder_key" ON "MatchQuestion"("matchId", "questionOrder");

-- CreateIndex
CREATE INDEX "PlayerAnswer_matchId_idx" ON "PlayerAnswer"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAnswer_playerId_matchQuestionId_key" ON "PlayerAnswer"("playerId", "matchQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRound_matchQuestionId_key" ON "MatchRound"("matchQuestionId");

-- CreateIndex
CREATE INDEX "MatchRound_matchId_idx" ON "MatchRound"("matchId");


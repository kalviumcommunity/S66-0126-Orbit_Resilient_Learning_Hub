-- CreateIndex
CREATE INDEX "Lesson_slug_idx" ON "Lesson"("slug");

-- CreateIndex
CREATE INDEX "Lesson_order_idx" ON "Lesson"("order");

-- CreateIndex
CREATE INDEX "Progress_userId_idx" ON "Progress"("userId");

-- CreateIndex
CREATE INDEX "Progress_completed_idx" ON "Progress"("completed");

-- CreateIndex
CREATE INDEX "Progress_userId_completed_idx" ON "Progress"("userId", "completed");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

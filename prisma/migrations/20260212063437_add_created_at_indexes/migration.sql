-- CreateIndex
CREATE INDEX "llm_usage_logs_created_at_idx" ON "llm_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "task_decisions_created_at_idx" ON "task_decisions"("created_at");

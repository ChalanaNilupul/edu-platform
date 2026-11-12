-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "active_workspace_id" TEXT;

-- CreateIndex
CREATE INDEX "sessions_active_workspace_id_idx" ON "sessions"("active_workspace_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_workspace_id_fkey" FOREIGN KEY ("active_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

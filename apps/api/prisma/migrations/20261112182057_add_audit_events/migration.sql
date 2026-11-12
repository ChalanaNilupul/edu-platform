-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_REGISTERED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'EMAIL_VERIFIED', 'EMAIL_VERIFICATION_RESENT', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'WORKSPACE_CREATED', 'WORKSPACE_SWITCHED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'INVITATION_CREATED', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED');

-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "actor_user_id" TEXT,
    "workspace_id" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_workspace_id_created_at_idx" ON "audit_events"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_type_created_at_idx" ON "audit_events"("type", "created_at");

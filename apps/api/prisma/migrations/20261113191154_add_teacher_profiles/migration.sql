-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'TEACHER_PROFILE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'TEACHER_PROFILE_UPDATED';

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "phone" TEXT,
    "qualifications" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "joined_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_membership_id_key" ON "teacher_profiles"("membership_id");

-- CreateIndex
CREATE INDEX "teacher_profiles_workspace_id_idx" ON "teacher_profiles"("workspace_id");

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation for teacher profiles, mirroring the students policy.
ALTER TABLE "teacher_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_profiles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "teacher_profiles_tenant" ON "teacher_profiles"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

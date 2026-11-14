-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_TEACHER_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_TEACHER_PRIMARY_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_TEACHER_REMOVED';

-- CreateTable
CREATE TABLE "class_teachers" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_teachers_workspace_id_class_id_idx" ON "class_teachers"("workspace_id", "class_id");

-- CreateIndex
CREATE INDEX "class_teachers_workspace_id_membership_id_idx" ON "class_teachers"("workspace_id", "membership_id");

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A teacher may not hold two active assignments for the same class, but ended
-- assignments remain as history and allow a later reassignment.
CREATE UNIQUE INDEX "class_teachers_class_id_membership_id_active_key"
ON "class_teachers"("class_id", "membership_id")
WHERE "ended_at" IS NULL;

-- Only one active primary teacher per class; ended rows keep their historical
-- flag without blocking a new primary.
CREATE UNIQUE INDEX "class_teachers_class_id_primary_active_key"
ON "class_teachers"("class_id")
WHERE "ended_at" IS NULL AND "is_primary" = true;

-- Tenant isolation for class teacher assignments, mirroring the enrollments policy.
ALTER TABLE "class_teachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_teachers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "class_teachers_tenant" ON "class_teachers"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

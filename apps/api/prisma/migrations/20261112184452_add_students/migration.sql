-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_STATUS_CHANGED';

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "student_code" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "date_of_birth" DATE,
    "gender" "StudentGender",
    "email" TEXT,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postal_code" TEXT,
    "school" TEXT,
    "grade" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_workspace_id_status_idx" ON "students"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "students_workspace_id_first_name_last_name_idx" ON "students"("workspace_id", "first_name", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "students_workspace_id_student_code_key" ON "students"("workspace_id", "student_code");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation for student records, mirroring memberships and invitations.
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;

CREATE POLICY "students_tenant" ON "students"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

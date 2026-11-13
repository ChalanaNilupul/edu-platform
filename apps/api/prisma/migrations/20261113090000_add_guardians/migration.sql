-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'GUARDIAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'GUARDIAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'GUARDIAN_UNLINKED';
ALTER TYPE "AuditEventType" ADD VALUE 'GUARDIAN_DELETED';

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "relationship" "GuardianRelationship" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "occupation" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postal_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardians_workspace_id_last_name_first_name_idx" ON "guardians"("workspace_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "student_guardians_workspace_id_idx" ON "student_guardians"("workspace_id");

-- CreateIndex
CREATE INDEX "student_guardians_guardian_id_idx" ON "student_guardians"("guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_student_id_guardian_id_key" ON "student_guardians"("student_id", "guardian_id");

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation for guardian records and links, mirroring the students policy.
ALTER TABLE "guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardians" FORCE ROW LEVEL SECURITY;

CREATE POLICY "guardians_tenant" ON "guardians"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_guardians" FORCE ROW LEVEL SECURITY;

CREATE POLICY "student_guardians_tenant" ON "student_guardians"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

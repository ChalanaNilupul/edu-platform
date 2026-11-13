-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_ENROLLED';
ALTER TYPE "AuditEventType" ADD VALUE 'ENROLLMENT_UPDATED';

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "description" TEXT,
    "capacity" INTEGER,
    "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "classes_workspace_id_status_idx" ON "classes"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "classes_workspace_id_name_key" ON "classes"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "enrollments_workspace_id_class_id_status_idx" ON "enrollments"("workspace_id", "class_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_workspace_id_student_id_idx" ON "enrollments"("workspace_id", "student_id");

-- A student may not be enrolled in the same class twice at once, but finished
-- enrollments remain as history and allow a later re-enrollment.
CREATE UNIQUE INDEX "enrollments_student_id_class_id_active_key"
ON "enrollments"("student_id", "class_id")
WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation for classes and enrollments, mirroring the students policy.
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "classes_tenant" ON "classes"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_tenant" ON "enrollments"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

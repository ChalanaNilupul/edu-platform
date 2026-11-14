-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_SCHEDULE_SLOT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_SCHEDULE_SLOT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLASS_SCHEDULE_SLOT_DELETED';

-- Required by the exclusion constraints below: gist cannot index a plain
-- equality match on class_id or day_of_week without the btree opclasses.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "class_schedule_slots" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,
    "room" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_schedule_slots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "class_schedule_slots_minutes_check" CHECK (
        "start_minutes" >= 0 AND "end_minutes" <= 1440 AND "start_minutes" < "end_minutes"
    )
);

-- CreateIndex
CREATE INDEX "class_schedule_slots_class_time_idx" ON "class_schedule_slots"("workspace_id", "class_id", "day_of_week", "start_minutes");

-- CreateIndex
CREATE INDEX "class_schedule_slots_teacher_time_idx" ON "class_schedule_slots"("workspace_id", "membership_id", "day_of_week", "start_minutes");

-- AddForeignKey
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Half-open ranges keep back-to-back slots legal while overlapping ones fail
-- with SQLSTATE 23P01. The teacher constraint is partial so slots without a
-- teacher never collide with each other.
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_no_class_overlap"
EXCLUDE USING gist (
  "class_id" WITH =,
  "day_of_week" WITH =,
  int4range("start_minutes", "end_minutes", '[)') WITH &&
);

ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_no_teacher_overlap"
EXCLUDE USING gist (
  "membership_id" WITH =,
  "day_of_week" WITH =,
  int4range("start_minutes", "end_minutes", '[)') WITH &&
) WHERE ("membership_id" IS NOT NULL);

-- Tenant isolation for the timetable, mirroring the other workspace tables.
ALTER TABLE "class_schedule_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_schedule_slots" FORCE ROW LEVEL SECURITY;

CREATE POLICY "class_schedule_slots_tenant" ON "class_schedule_slots"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

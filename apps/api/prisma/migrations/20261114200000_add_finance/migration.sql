-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "FeePlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'FEE_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'FEE_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'FEE_PLAN_ARCHIVED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_FEES_GENERATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_FEE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_FEE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'STUDENT_FEE_VOIDED';
ALTER TYPE "AuditEventType" ADD VALUE 'PAYMENT_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'PAYMENT_DELETED';

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'LKR';

-- CreateTable
CREATE TABLE "fee_plans" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "class_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "billing_period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "due_day" INTEGER NOT NULL DEFAULT 1,
    "status" "FeePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fees" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_plan_id" TEXT,
    "class_id" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FeeStatus" NOT NULL DEFAULT 'UNPAID',
    "period_month" DATE,
    "due_date" DATE NOT NULL,
    "note" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "student_fee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recorded_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_plans_workspace_id_status_idx" ON "fee_plans"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "fee_plans_workspace_id_class_id_idx" ON "fee_plans"("workspace_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_plans_workspace_id_name_key" ON "fee_plans"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "student_fees_workspace_id_status_idx" ON "student_fees"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "student_fees_workspace_id_student_id_idx" ON "student_fees"("workspace_id", "student_id");

-- CreateIndex
CREATE INDEX "student_fees_workspace_id_period_month_idx" ON "student_fees"("workspace_id", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "student_fees_plan_period_key" ON "student_fees"("student_id", "fee_plan_id", "period_month");

-- CreateIndex
CREATE INDEX "payments_workspace_id_student_fee_id_idx" ON "payments"("workspace_id", "student_fee_id");

-- CreateIndex
CREATE INDEX "payments_workspace_id_paid_at_idx" ON "payments"("workspace_id", "paid_at");

-- AddForeignKey
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_fee_plan_id_fkey" FOREIGN KEY ("fee_plan_id") REFERENCES "fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_fee_id_fkey" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_membership_id_fkey" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Money and billing guards, mirrored by DTO validation in the API.
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_amount_check" CHECK ("amount" > 0);
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_due_day_check" CHECK ("due_day" BETWEEN 1 AND 28);
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_amount_check" CHECK ("amount" > 0);
ALTER TABLE "student_fees" ADD CONSTRAINT "student_fees_paid_amount_check" CHECK ("paid_amount" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);

-- Tenant isolation for plans, fee records and payments, mirroring the other
-- workspace tables.
ALTER TABLE "fee_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_plans" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fee_plans_tenant" ON "fee_plans"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

ALTER TABLE "student_fees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_fees" FORCE ROW LEVEL SECURITY;

CREATE POLICY "student_fees_tenant" ON "student_fees"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payments_tenant" ON "payments"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

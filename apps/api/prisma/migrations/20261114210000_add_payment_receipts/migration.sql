-- Receipt numbers are stored as integers and rendered as RCPT-000001 by the API.
ALTER TABLE "payments" ADD COLUMN "receipt_number" INTEGER;

-- Backfill existing payments in creation order so every workspace starts at 1.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workspace_id" ORDER BY "created_at", "id") AS rn
  FROM "payments"
)
UPDATE "payments" p
SET "receipt_number" = n.rn
FROM numbered n
WHERE p."id" = n."id";

ALTER TABLE "payments" ALTER COLUMN "receipt_number" SET NOT NULL;

-- CreateTable
CREATE TABLE "workspace_counters" (
    "workspace_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "workspace_counters_pkey" PRIMARY KEY ("workspace_id", "key")
);

-- Seed the receipt counter at the last backfilled number so the next payment
-- continues the sequence instead of restarting at 1.
INSERT INTO "workspace_counters" ("workspace_id", "key", "value")
SELECT "workspace_id", 'payment_receipt', MAX("receipt_number")
FROM "payments"
GROUP BY "workspace_id";

-- CreateIndex
CREATE UNIQUE INDEX "payments_workspace_id_receipt_number_key" ON "payments"("workspace_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "workspace_counters" ADD CONSTRAINT "workspace_counters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Receipt counters are drawn from and never reset, so they stay positive.
ALTER TABLE "workspace_counters" ADD CONSTRAINT "workspace_counters_value_check" CHECK ("value" > 0);

-- Tenant isolation for counters, mirroring the other workspace tables.
ALTER TABLE "workspace_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_counters" FORCE ROW LEVEL SECURITY;

CREATE POLICY "workspace_counters_tenant" ON "workspace_counters"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

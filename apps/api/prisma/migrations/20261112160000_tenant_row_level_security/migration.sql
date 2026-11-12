-- Tenant isolation for workspace-owned tables.
--
-- The application sets `app.workspace_id` or `app.user_id` inside a transaction
-- (`set_config(..., true)`) so the values never leak across pooled connections.
-- `app.bypass_rls` is reserved for the few operations that legitimately run
-- without tenant context (token-based invitation acceptance and migrations).

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select" ON "memberships"
FOR SELECT
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
  OR "user_id" = nullif(current_setting('app.user_id', true), '')
);

CREATE POLICY "memberships_write" ON "memberships"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invitations_tenant" ON "workspace_invitations"
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
)
WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR "workspace_id" = nullif(current_setting('app.workspace_id', true), '')
);

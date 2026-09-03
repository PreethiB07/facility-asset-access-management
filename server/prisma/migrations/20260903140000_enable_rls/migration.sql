-- Stage 15: PostgreSQL Row-Level Security for company isolation

CREATE SCHEMA IF NOT EXISTS app;

-- Session variable helpers (transaction-local via set_config(..., true))
-- Prisma UUID columns are stored as TEXT — helpers return text for type compatibility.
CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app.auth_email_lookup()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.auth_email_lookup', true), '');
$$;

CREATE OR REPLACE FUNCTION app.is_system_bootstrap()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.system_bootstrap', true), '') = 'true';
$$;

CREATE OR REPLACE FUNCTION app.is_tenant_context_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_company_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.tenant_company_matches(row_company_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.is_tenant_context_active() AND row_company_id = app.current_company_id();
$$;

-- Runtime application role (no BYPASSRLS). Migrations/seed use DATABASE_DIRECT_URL (postgres).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'faam_app') THEN
    CREATE ROLE faam_app LOGIN PASSWORD 'faam_app_dev';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO faam_app;
GRANT USAGE ON SCHEMA app TO faam_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO faam_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO faam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO faam_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO faam_app;

-- Company: readable for own tenant or during bootstrap (registration default company lookup)
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" FORCE ROW LEVEL SECURITY;

CREATE POLICY company_select ON "Company"
  FOR SELECT
  USING (
    app.is_system_bootstrap()
    OR (app.is_tenant_context_active() AND id = app.current_company_id())
  );

CREATE POLICY company_insert ON "Company"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap());

CREATE POLICY company_update ON "Company"
  FOR UPDATE
  USING (app.is_system_bootstrap())
  WITH CHECK (app.is_system_bootstrap());

CREATE POLICY company_delete ON "Company"
  FOR DELETE
  USING (app.is_system_bootstrap());

-- User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_select ON "User"
  FOR SELECT
  USING (
    app.is_system_bootstrap()
    OR app.tenant_company_matches("companyId")
    OR (app.current_user_id() IS NOT NULL AND id = app.current_user_id())
    OR (app.auth_email_lookup() IS NOT NULL AND email = app.auth_email_lookup())
  );

CREATE POLICY user_insert ON "User"
  FOR INSERT
  WITH CHECK (
    app.is_system_bootstrap()
    OR app.tenant_company_matches("companyId")
  );

CREATE POLICY user_update ON "User"
  FOR UPDATE
  USING (
    app.is_system_bootstrap()
    OR app.tenant_company_matches("companyId")
    OR (app.current_user_id() IS NOT NULL AND id = app.current_user_id())
  )
  WITH CHECK (
    app.is_system_bootstrap()
    OR app.tenant_company_matches("companyId")
    OR (app.current_user_id() IS NOT NULL AND id = app.current_user_id())
  );

CREATE POLICY user_delete ON "User"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

-- Facility
ALTER TABLE "Facility" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Facility" FORCE ROW LEVEL SECURITY;

CREATE POLICY facility_select ON "Facility"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY facility_insert ON "Facility"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY facility_update ON "Facility"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY facility_delete ON "Facility"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

-- Area
ALTER TABLE "Area" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Area" FORCE ROW LEVEL SECURITY;

CREATE POLICY area_select ON "Area"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY area_insert ON "Area"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY area_update ON "Area"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY area_delete ON "Area"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

-- Asset
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" FORCE ROW LEVEL SECURITY;

CREATE POLICY asset_select ON "Asset"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY asset_insert ON "Asset"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY asset_update ON "Asset"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY asset_delete ON "Asset"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

-- AccessRequest
ALTER TABLE "AccessRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY access_request_select ON "AccessRequest"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY access_request_insert ON "AccessRequest"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY access_request_update ON "AccessRequest"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY access_request_delete ON "AccessRequest"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

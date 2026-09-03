-- Final requirement: createdBy / requestedFor, approval delegation, approval history

CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- Add createdById and migrate requesterId -> requestedForId
ALTER TABLE "AccessRequest" ADD COLUMN "createdById" TEXT;

UPDATE "AccessRequest" SET "createdById" = "requesterId" WHERE "createdById" IS NULL;

ALTER TABLE "AccessRequest" ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "AccessRequest" RENAME COLUMN "requesterId" TO "requestedForId";

DROP INDEX IF EXISTS "AccessRequest_requesterId_idx";
CREATE INDEX "AccessRequest_createdById_idx" ON "AccessRequest"("createdById");
CREATE INDEX "AccessRequest_requestedForId_idx" ON "AccessRequest"("requestedForId");

ALTER TABLE "AccessRequest" DROP CONSTRAINT IF EXISTS "AccessRequest_requesterId_fkey";
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_requestedForId_fkey"
  FOREIGN KEY ("requestedForId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update company consistency trigger for createdBy and requestedFor
CREATE OR REPLACE FUNCTION enforce_access_request_company_consistency()
RETURNS TRIGGER AS $$
DECLARE
    created_by_company_id TEXT;
    requested_for_company_id TEXT;
    target_company_id TEXT;
BEGIN
    SELECT "companyId" INTO created_by_company_id
    FROM "User"
    WHERE "id" = NEW."createdById";

    IF created_by_company_id IS NULL THEN
        RAISE EXCEPTION 'AccessRequest references a non-existent creator';
    END IF;

    SELECT "companyId" INTO requested_for_company_id
    FROM "User"
    WHERE "id" = NEW."requestedForId";

    IF requested_for_company_id IS NULL THEN
        RAISE EXCEPTION 'AccessRequest references a non-existent beneficiary';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM created_by_company_id THEN
        RAISE EXCEPTION 'AccessRequest companyId must match creator companyId';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM requested_for_company_id THEN
        RAISE EXCEPTION 'AccessRequest companyId must match beneficiary companyId';
    END IF;

    IF NEW."facilityId" IS NOT NULL THEN
        SELECT "companyId" INTO target_company_id FROM "Facility" WHERE "id" = NEW."facilityId";
        IF target_company_id IS DISTINCT FROM NEW."companyId" THEN
            RAISE EXCEPTION 'AccessRequest target facility belongs to a different company';
        END IF;
    ELSIF NEW."areaId" IS NOT NULL THEN
        SELECT "companyId" INTO target_company_id FROM "Area" WHERE "id" = NEW."areaId";
        IF target_company_id IS DISTINCT FROM NEW."companyId" THEN
            RAISE EXCEPTION 'AccessRequest target area belongs to a different company';
        END IF;
    ELSIF NEW."assetId" IS NOT NULL THEN
        SELECT "companyId" INTO target_company_id FROM "Asset" WHERE "id" = NEW."assetId";
        IF target_company_id IS DISTINCT FROM NEW."companyId" THEN
            RAISE EXCEPTION 'AccessRequest target asset belongs to a different company';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Approval delegation
CREATE TABLE "ApprovalDelegation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "delegatingManagerId" TEXT NOT NULL,
    "delegatedManagerId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalDelegation_companyId_idx" ON "ApprovalDelegation"("companyId");
CREATE INDEX "ApprovalDelegation_delegatingManagerId_idx" ON "ApprovalDelegation"("delegatingManagerId");
CREATE INDEX "ApprovalDelegation_delegatedManagerId_idx" ON "ApprovalDelegation"("delegatedManagerId");
CREATE INDEX "ApprovalDelegation_effectiveFrom_effectiveUntil_idx" ON "ApprovalDelegation"("effectiveFrom", "effectiveUntil");

ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_delegatingManagerId_fkey"
  FOREIGN KEY ("delegatingManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_delegatedManagerId_fkey"
  FOREIGN KEY ("delegatedManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_no_self_delegation"
  CHECK ("delegatingManagerId" <> "delegatedManagerId");

ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_valid_period"
  CHECK ("effectiveUntil" > "effectiveFrom");

-- Approval history
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalHistory_companyId_idx" ON "ApprovalHistory"("companyId");
CREATE INDEX "ApprovalHistory_accessRequestId_idx" ON "ApprovalHistory"("accessRequestId");
CREATE INDEX "ApprovalHistory_actorId_idx" ON "ApprovalHistory"("actorId");

ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_accessRequestId_fkey"
  FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Delegation company consistency trigger
CREATE OR REPLACE FUNCTION enforce_approval_delegation_company_consistency()
RETURNS TRIGGER AS $$
DECLARE
    delegator_company_id TEXT;
    delegate_company_id TEXT;
    delegator_role "Role";
    delegate_role "Role";
BEGIN
    SELECT "companyId", "role" INTO delegator_company_id, delegator_role
    FROM "User"
    WHERE "id" = NEW."delegatingManagerId";

    IF delegator_company_id IS NULL THEN
        RAISE EXCEPTION 'ApprovalDelegation references a non-existent delegating manager';
    END IF;

    SELECT "companyId", "role" INTO delegate_company_id, delegate_role
    FROM "User"
    WHERE "id" = NEW."delegatedManagerId";

    IF delegate_company_id IS NULL THEN
        RAISE EXCEPTION 'ApprovalDelegation references a non-existent delegated manager';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM delegator_company_id THEN
        RAISE EXCEPTION 'ApprovalDelegation companyId must match delegating manager companyId';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM delegate_company_id THEN
        RAISE EXCEPTION 'ApprovalDelegation companyId must match delegated manager companyId';
    END IF;

    IF delegator_role NOT IN ('MANAGER', 'ADMIN') THEN
        RAISE EXCEPTION 'Delegating user must be a manager or admin';
    END IF;

    IF delegate_role NOT IN ('MANAGER', 'ADMIN') THEN
        RAISE EXCEPTION 'Delegated user must be a manager or admin';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_delegation_company_consistency
    BEFORE INSERT OR UPDATE ON "ApprovalDelegation"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_approval_delegation_company_consistency();

-- Approval history company consistency trigger
CREATE OR REPLACE FUNCTION enforce_approval_history_company_consistency()
RETURNS TRIGGER AS $$
DECLARE
    actor_company_id TEXT;
    request_company_id TEXT;
BEGIN
    SELECT "companyId" INTO actor_company_id
    FROM "User"
    WHERE "id" = NEW."actorId";

    IF actor_company_id IS NULL THEN
        RAISE EXCEPTION 'ApprovalHistory references a non-existent actor';
    END IF;

    SELECT "companyId" INTO request_company_id
    FROM "AccessRequest"
    WHERE "id" = NEW."accessRequestId";

    IF request_company_id IS NULL THEN
        RAISE EXCEPTION 'ApprovalHistory references a non-existent access request';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM actor_company_id THEN
        RAISE EXCEPTION 'ApprovalHistory companyId must match actor companyId';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM request_company_id THEN
        RAISE EXCEPTION 'ApprovalHistory companyId must match access request companyId';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_history_company_consistency
    BEFORE INSERT OR UPDATE ON "ApprovalHistory"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_approval_history_company_consistency();

-- RLS for new tables
ALTER TABLE "ApprovalDelegation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalDelegation" FORCE ROW LEVEL SECURITY;

CREATE POLICY approval_delegation_select ON "ApprovalDelegation"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_delegation_insert ON "ApprovalDelegation"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_delegation_update ON "ApprovalDelegation"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_delegation_delete ON "ApprovalDelegation"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

ALTER TABLE "ApprovalHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalHistory" FORCE ROW LEVEL SECURITY;

CREATE POLICY approval_history_select ON "ApprovalHistory"
  FOR SELECT
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_history_insert ON "ApprovalHistory"
  FOR INSERT
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_history_update ON "ApprovalHistory"
  FOR UPDATE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"))
  WITH CHECK (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

CREATE POLICY approval_history_delete ON "ApprovalHistory"
  FOR DELETE
  USING (app.is_system_bootstrap() OR app.tenant_company_matches("companyId"));

GRANT SELECT, INSERT, UPDATE, DELETE ON "ApprovalDelegation" TO faam_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ApprovalHistory" TO faam_app;

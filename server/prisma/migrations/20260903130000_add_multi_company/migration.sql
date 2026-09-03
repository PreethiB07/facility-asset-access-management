-- Stage 13: Multi-company support — safe migration for existing data

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- Legacy/default company for existing single-tenant data
INSERT INTO "Company" ("id", "name", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Acme Corporation',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Step 1: Add nullable companyId columns
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Facility" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Area" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "companyId" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN "companyId" TEXT;

-- Step 2: Backfill existing records
UPDATE "User"
SET "companyId" = '00000000-0000-4000-8000-000000000001'
WHERE "companyId" IS NULL;

UPDATE "Facility"
SET "companyId" = '00000000-0000-4000-8000-000000000001'
WHERE "companyId" IS NULL;

UPDATE "Area" AS a
SET "companyId" = f."companyId"
FROM "Facility" AS f
WHERE a."facilityId" = f."id"
  AND a."companyId" IS NULL;

UPDATE "Asset" AS a
SET "companyId" = f."companyId"
FROM "Facility" AS f
WHERE a."facilityId" = f."id"
  AND a."companyId" IS NULL;

UPDATE "AccessRequest" AS ar
SET "companyId" = u."companyId"
FROM "User" AS u
WHERE ar."requesterId" = u."id"
  AND ar."companyId" IS NULL;

-- Step 3: Enforce NOT NULL after backfill
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Facility" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Area" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AccessRequest" ALTER COLUMN "companyId" SET NOT NULL;

-- Step 4: Replace global email uniqueness with per-company uniqueness
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- Step 5: Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Facility" ADD CONSTRAINT "Facility_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Area" ADD CONSTRAINT "Area_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 6: Indexes for tenant-scoped queries
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "Facility_companyId_idx" ON "Facility"("companyId");
CREATE INDEX "Area_companyId_idx" ON "Area"("companyId");
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");
CREATE INDEX "AccessRequest_companyId_idx" ON "AccessRequest"("companyId");

-- Step 7: Database triggers for cross-entity company consistency
CREATE OR REPLACE FUNCTION enforce_area_company_matches_facility()
RETURNS TRIGGER AS $$
DECLARE
    facility_company_id TEXT;
BEGIN
    SELECT "companyId" INTO facility_company_id
    FROM "Facility"
    WHERE "id" = NEW."facilityId";

    IF facility_company_id IS NULL THEN
        RAISE EXCEPTION 'Area references a non-existent facility';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM facility_company_id THEN
        RAISE EXCEPTION 'Area companyId must match parent Facility companyId';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER area_company_consistency
    BEFORE INSERT OR UPDATE ON "Area"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_area_company_matches_facility();

CREATE OR REPLACE FUNCTION enforce_asset_company_consistency()
RETURNS TRIGGER AS $$
DECLARE
    facility_company_id TEXT;
    area_company_id TEXT;
BEGIN
    SELECT "companyId" INTO facility_company_id
    FROM "Facility"
    WHERE "id" = NEW."facilityId";

    IF facility_company_id IS NULL THEN
        RAISE EXCEPTION 'Asset references a non-existent facility';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM facility_company_id THEN
        RAISE EXCEPTION 'Asset companyId must match parent Facility companyId';
    END IF;

    IF NEW."areaId" IS NOT NULL THEN
        SELECT "companyId" INTO area_company_id
        FROM "Area"
        WHERE "id" = NEW."areaId";

        IF area_company_id IS NULL THEN
            RAISE EXCEPTION 'Asset references a non-existent area';
        END IF;

        IF NEW."companyId" IS DISTINCT FROM area_company_id THEN
            RAISE EXCEPTION 'Asset companyId must match parent Area companyId';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_company_consistency
    BEFORE INSERT OR UPDATE ON "Asset"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_asset_company_consistency();

CREATE OR REPLACE FUNCTION enforce_access_request_company_consistency()
RETURNS TRIGGER AS $$
DECLARE
    requester_company_id TEXT;
    target_company_id TEXT;
BEGIN
    SELECT "companyId" INTO requester_company_id
    FROM "User"
    WHERE "id" = NEW."requesterId";

    IF requester_company_id IS NULL THEN
        RAISE EXCEPTION 'AccessRequest references a non-existent requester';
    END IF;

    IF NEW."companyId" IS DISTINCT FROM requester_company_id THEN
        RAISE EXCEPTION 'AccessRequest companyId must match requester companyId';
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

CREATE TRIGGER access_request_company_consistency
    BEFORE INSERT OR UPDATE ON "AccessRequest"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_access_request_company_consistency();

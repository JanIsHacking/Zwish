-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "zone_test_protocol" TEXT;

UPDATE "workouts" SET "zone_test_protocol" = 'ramp' WHERE "kind" = 'zone_test';

-- AlterTable
ALTER TABLE "zone_tests" ADD COLUMN "protocol" TEXT;

UPDATE "zone_tests" SET "protocol" = 'ramp' WHERE "protocol" IS NULL;

ALTER TABLE "zone_tests" ALTER COLUMN "protocol" SET NOT NULL;

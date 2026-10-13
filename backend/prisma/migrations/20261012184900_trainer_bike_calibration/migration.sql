-- Curves now belong to a trainer and a bike. Previous trainer-only captures are dropped.

DROP TABLE "power_curves";
DROP TABLE "calibration_runs";

CREATE TABLE "trainer_bikes" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "inertia_kg_m2" DOUBLE PRECISION,

    CONSTRAINT "trainer_bikes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calibration_runs" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "resistance_level_id" TEXT NOT NULL,
    "tire_pressure_bar" DOUBLE PRECISION NOT NULL,
    "target_rpm" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "coast_start_mono_us" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "samples" JSONB NOT NULL DEFAULT '[]',
    "coast" JSONB NOT NULL DEFAULT '[]',
    "fit_kind" TEXT,
    "fit_coeffs" JSONB,

    CONSTRAINT "calibration_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_curves" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "resistance_level_id" TEXT NOT NULL,
    "knots" JSONB NOT NULL,
    "coast" JSONB NOT NULL,
    "fit_kind" TEXT NOT NULL,
    "fit_coeffs" JSONB NOT NULL,
    "tire_pressure_bar" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calibration_run_id" TEXT,

    CONSTRAINT "power_curves_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_bikes_trainer_id_bike_id_key" ON "trainer_bikes"("trainer_id", "bike_id");

CREATE UNIQUE INDEX "power_curves_calibration_run_id_key" ON "power_curves"("calibration_run_id");

CREATE INDEX "power_curves_trainer_id_bike_id_resistance_level_id_is_acti_idx" ON "power_curves"("trainer_id", "bike_id", "resistance_level_id", "is_active");

CREATE INDEX "calibration_runs_trainer_id_status_idx" ON "calibration_runs"("trainer_id", "status");

ALTER TABLE "trainer_bikes" ADD CONSTRAINT "trainer_bikes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_bikes" ADD CONSTRAINT "trainer_bikes_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "power_curves" ADD CONSTRAINT "power_curves_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "power_curves" ADD CONSTRAINT "power_curves_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "power_curves" ADD CONSTRAINT "power_curves_calibration_run_id_fkey" FOREIGN KEY ("calibration_run_id") REFERENCES "calibration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

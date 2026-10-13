-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ftp_watts" DOUBLE PRECISION,
    "hr_zone_bounds" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bikes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wheel_circumference_mm" INTEGER NOT NULL,
    "chainring_teeth" INTEGER[],
    "cog_teeth" INTEGER[],

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_id" TEXT,
    "power_scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resistance_levels" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "resistance_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "power_curves" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "resistance_level_id" TEXT NOT NULL,
    "knots" JSONB NOT NULL,
    "tire_pressure_bar" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calibration_run_id" TEXT,

    CONSTRAINT "power_curves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_runs" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "resistance_level_id" TEXT NOT NULL,
    "tire_pressure_bar" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "samples" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "calibration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_sessions" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "plan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_segments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "target_kind" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "plan_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "plan_session_id" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "resistance_level_id" TEXT,
    "chainring_teeth" INTEGER,
    "cog_teeth" INTEGER,
    "distance_m" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_power_w" DOUBLE PRECISION,
    "avg_cadence_rpm" DOUBLE PRECISION,
    "avg_hr_bpm" DOUBLE PRECISION,
    "estimated_ftp" DOUBLE PRECISION,
    "zone_test_start_w" DOUBLE PRECISION,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_samples" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "wheel_rpm" DOUBLE PRECISION NOT NULL,
    "power_w" DOUBLE PRECISION,
    "cadence_rpm" DOUBLE PRECISION,
    "hr_bpm" DOUBLE PRECISION,
    "distance_m" DOUBLE PRECISION NOT NULL,
    "speed_mps" DOUBLE PRECISION NOT NULL,
    "resistance_level_id" TEXT,
    "chainring_teeth" INTEGER,
    "cog_teeth" INTEGER,

    CONSTRAINT "workout_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_tests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "estimated_ftp" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_setups" (
    "user_id" TEXT NOT NULL,
    "trainer_id" TEXT,
    "bike_id" TEXT,
    "resistance_level_id" TEXT,
    "chainring_teeth" INTEGER,
    "cog_teeth" INTEGER,

    CONSTRAINT "rider_setups_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_device_id_key" ON "trainers"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "resistance_levels_trainer_id_sort_order_key" ON "resistance_levels"("trainer_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "power_curves_calibration_run_id_key" ON "power_curves"("calibration_run_id");

-- CreateIndex
CREATE INDEX "power_curves_trainer_id_resistance_level_id_is_active_idx" ON "power_curves"("trainer_id", "resistance_level_id", "is_active");

-- CreateIndex
CREATE INDEX "calibration_runs_trainer_id_status_idx" ON "calibration_runs"("trainer_id", "status");

-- CreateIndex
CREATE INDEX "workouts_user_id_started_at_idx" ON "workouts"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "workouts_trainer_id_status_idx" ON "workouts"("trainer_id", "status");

-- CreateIndex
CREATE INDEX "workout_samples_workout_id_recorded_at_idx" ON "workout_samples"("workout_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "zone_tests_workout_id_key" ON "zone_tests"("workout_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resistance_levels" ADD CONSTRAINT "resistance_levels_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_curves" ADD CONSTRAINT "power_curves_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_curves" ADD CONSTRAINT "power_curves_calibration_run_id_fkey" FOREIGN KEY ("calibration_run_id") REFERENCES "calibration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_segments" ADD CONSTRAINT "plan_segments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "plan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_session_id_fkey" FOREIGN KEY ("plan_session_id") REFERENCES "plan_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_samples" ADD CONSTRAINT "workout_samples_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_tests" ADD CONSTRAINT "zone_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_tests" ADD CONSTRAINT "zone_tests_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_setups" ADD CONSTRAINT "rider_setups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

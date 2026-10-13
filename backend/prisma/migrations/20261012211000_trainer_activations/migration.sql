-- CreateTable
CREATE TABLE "trainer_activations" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "mono_us" BIGINT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "rev_count" DOUBLE PRECISION NOT NULL,
    "dt_us" BIGINT NOT NULL,

    CONSTRAINT "trainer_activations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_activations_trainer_id_seq_key" ON "trainer_activations"("trainer_id", "seq");

-- CreateIndex
CREATE INDEX "trainer_activations_trainer_id_recorded_at_idx" ON "trainer_activations"("trainer_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "trainer_activations" ADD CONSTRAINT "trainer_activations_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "power_weighted_sum" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workouts" ADD COLUMN "power_weight_sec" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workouts" ADD COLUMN "cadence_weighted_sum" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workouts" ADD COLUMN "cadence_weight_sec" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workouts" ADD COLUMN "hr_weighted_sum" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workouts" ADD COLUMN "hr_weight_sec" DOUBLE PRECISION NOT NULL DEFAULT 0;

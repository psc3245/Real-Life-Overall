CREATE TYPE "public"."workout_kind" AS ENUM('strength', 'cardio');--> statement-breakpoint
ALTER TYPE "public"."exercise_tracking" ADD VALUE 'weight_duration';--> statement-breakpoint
ALTER TYPE "public"."exercise_tracking" ADD VALUE 'weight_distance';--> statement-breakpoint
ALTER TYPE "public"."exercise_tracking" ADD VALUE 'distance';--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "kind" "workout_kind" DEFAULT 'strength' NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "cardio" jsonb;
ALTER TYPE "public"."workout_kind" ADD VALUE 'sport';--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "kind" "workout_kind" DEFAULT 'strength' NOT NULL;
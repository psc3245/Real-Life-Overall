CREATE TYPE "public"."objective_kind" AS ENUM('total', 'reach');--> statement-breakpoint
ALTER TYPE "public"."objective_source" ADD VALUE 'weight';--> statement-breakpoint
ALTER TABLE "objectives" DROP CONSTRAINT "objectives_target_positive";--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "kind" "objective_kind" DEFAULT 'total' NOT NULL;--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "start_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_reach_start" CHECK (("objectives"."kind" = 'reach') = ("objectives"."start_value" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_target_positive" CHECK ("objectives"."target" > 0 OR ("objectives"."kind" = 'reach' AND "objectives"."target" >= 0));
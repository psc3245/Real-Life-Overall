ALTER TABLE "day_logs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "status" SET DEFAULT 'open'::text;--> statement-breakpoint
DROP TYPE "public"."day_status";--> statement-breakpoint
CREATE TYPE "public"."day_status" AS ENUM('open', 'recapped', 'stale');--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."day_status";--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "status" SET DATA TYPE "public"."day_status" USING "status"::"public"."day_status";--> statement-breakpoint
ALTER TABLE "day_logs" DROP COLUMN "submitted_at";
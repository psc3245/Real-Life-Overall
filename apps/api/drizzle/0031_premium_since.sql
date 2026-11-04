ALTER TABLE "users" ADD COLUMN "premium_since" timestamp with time zone;--> statement-breakpoint
-- Accounts that are already Premium, Dev or Admin count from when they joined.
UPDATE "users" SET "premium_since" = "created_at" WHERE "role" <> 'user';

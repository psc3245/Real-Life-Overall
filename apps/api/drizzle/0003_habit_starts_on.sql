ALTER TABLE "habits" ADD COLUMN "starts_on" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
-- Existing habits started when they were created (UTC date; close enough for pre-existing rows).
UPDATE "habits" SET "starts_on" = ("created_at" AT TIME ZONE 'UTC')::date;

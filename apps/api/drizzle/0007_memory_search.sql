ALTER TABLE "day_logs" ADD COLUMN "journal_search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "day_logs"."journal")) STORED;--> statement-breakpoint
ALTER TABLE "recaps" ADD COLUMN "narrative_search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "recaps"."narrative")) STORED;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_summary" text;--> statement-breakpoint
CREATE INDEX "day_logs_journal_search" ON "day_logs" USING gin ("journal_search");--> statement-breakpoint
CREATE INDEX "recaps_narrative_search" ON "recaps" USING gin ("narrative_search");
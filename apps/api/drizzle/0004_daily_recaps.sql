CREATE TYPE "public"."recap_kind" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."recap_status" AS ENUM('active', 'superseded');--> statement-breakpoint
ALTER TYPE "public"."day_status" ADD VALUE 'stale';--> statement-breakpoint
CREATE TABLE "recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" "recap_kind" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"narrative" text NOT NULL,
	"output" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"status" "recap_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_logs" ADD COLUMN "prompts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rating_events" ADD COLUMN "recap_id" uuid;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recaps_one_active_per_period" ON "recaps" USING btree ("user_id","kind","period_start") WHERE "recaps"."status" = 'active';--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rating_events_recap_id_index" ON "rating_events" USING btree ("recap_id");
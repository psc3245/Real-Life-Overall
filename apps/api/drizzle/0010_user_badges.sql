CREATE TYPE "public"."badge_kind" AS ENUM('catalog', 'personal');--> statement-breakpoint
CREATE TYPE "public"."badge_tier" AS ENUM('bronze', 'silver', 'gold', 'hof');--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid,
	"kind" "badge_kind" NOT NULL,
	"badge_key" text NOT NULL,
	"tier" "badge_tier",
	"name" text NOT NULL,
	"description" text NOT NULL,
	"recap_id" uuid,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_one_per_tier" ON "user_badges" USING btree ("user_id","badge_key","tier");--> statement-breakpoint
CREATE INDEX "user_badges_recap_id_index" ON "user_badges" USING btree ("recap_id");
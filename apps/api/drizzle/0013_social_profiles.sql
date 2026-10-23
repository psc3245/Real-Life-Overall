CREATE TYPE "public"."profile_visibility" AS ENUM('private', 'friends', 'public');--> statement-breakpoint
CREATE TABLE "player_cards" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"season_label" text NOT NULL,
	"overall" numeric(5, 2) NOT NULL,
	"archetype" text,
	"categories" jsonb NOT NULL,
	"recapped_days" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_visibility" "profile_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_cards" ADD CONSTRAINT "player_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_cards" ADD CONSTRAINT "player_cards_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_cards_season_label_overall_index" ON "player_cards" USING btree ("season_label","overall");
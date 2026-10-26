CREATE TYPE "public"."season_mode" AS ENUM('rating', 'growth');--> statement-breakpoint
ALTER TABLE "player_cards" ADD COLUMN "mode" "season_mode" DEFAULT 'rating' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_cards" ADD COLUMN "growth" numeric(7, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "mode" "season_mode" DEFAULT 'rating' NOT NULL;
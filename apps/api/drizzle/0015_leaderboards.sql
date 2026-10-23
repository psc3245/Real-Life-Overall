ALTER TABLE "player_cards" ADD COLUMN "flagged_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "leaderboard_opt_in" boolean DEFAULT false NOT NULL;
CREATE TYPE "public"."soul_level_kind" AS ENUM('start', 'level_up');--> statement-breakpoint
ALTER TYPE "public"."season_mode" ADD VALUE 'souls';--> statement-breakpoint
CREATE TABLE "soul_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"kind" "soul_level_kind" NOT NULL,
	"levels" smallint NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"after_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soul_levels" ADD CONSTRAINT "soul_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soul_levels" ADD CONSTRAINT "soul_levels_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soul_levels" ADD CONSTRAINT "soul_levels_node_id_rating_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "soul_levels_season_id_index" ON "soul_levels" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "soul_levels_one_start" ON "soul_levels" USING btree ("node_id") WHERE "soul_levels"."kind" = 'start';
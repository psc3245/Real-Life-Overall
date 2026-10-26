CREATE TYPE "public"."tree_proposal_status" AS ENUM('pending', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TABLE "tree_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"recap_id" uuid,
	"reason" text NOT NULL,
	"changes" jsonb NOT NULL,
	"status" "tree_proposal_status" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"recap_id" uuid,
	"from_weight" numeric(8, 4) NOT NULL,
	"to_weight" numeric(8, 4) NOT NULL,
	"from_share" double precision NOT NULL,
	"to_share" double precision NOT NULL,
	"reason" text NOT NULL,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "scouting_report" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tree_proposals" ADD CONSTRAINT "tree_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_proposals" ADD CONSTRAINT "tree_proposals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_proposals" ADD CONSTRAINT "tree_proposals_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_changes" ADD CONSTRAINT "weight_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_changes" ADD CONSTRAINT "weight_changes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_changes" ADD CONSTRAINT "weight_changes_node_id_rating_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_changes" ADD CONSTRAINT "weight_changes_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tree_proposals_user_id_created_at_index" ON "tree_proposals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tree_proposals_recap_id_index" ON "tree_proposals" USING btree ("recap_id");--> statement-breakpoint
CREATE INDEX "weight_changes_season_id_created_at_index" ON "weight_changes" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "weight_changes_recap_id_index" ON "weight_changes" USING btree ("recap_id");
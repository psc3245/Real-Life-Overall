CREATE TYPE "public"."decay_author" AS ENUM('llm', 'user');--> statement-breakpoint
CREATE TYPE "public"."onboarding_stage" AS ENUM('tree', 'weights', 'questionnaire', 'followup', 'rating', 'complete');--> statement-breakpoint
CREATE TYPE "public"."rating_event_source" AS ENUM('onboarding', 'daily_recap', 'weekly_review', 'decay', 'recalibration');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('setup', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "decay_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"grace_days" smallint NOT NULL,
	"per_day" numeric(4, 2) NOT NULL,
	"floor" numeric(5, 2) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"authored_by" "decay_author" DEFAULT 'llm' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"target_value" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"latency_ms" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"stage" "onboarding_stage" DEFAULT 'tree' NOT NULL,
	"priorities" text,
	"questionnaire" jsonb,
	"answers" jsonb,
	"chat" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"delta" numeric(6, 2) NOT NULL,
	"source" "rating_event_source" NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"lineage_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"depth" smallint NOT NULL,
	"weight" numeric(8, 4) DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"template_key" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_nodes_depth_range" CHECK ("rating_nodes"."depth" between 0 and 3),
	CONSTRAINT "rating_nodes_weight_positive" CHECK ("rating_nodes"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "season_status" DEFAULT 'setup' NOT NULL,
	"archetype" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"week_start" smallint DEFAULT 1 NOT NULL,
	"auth_subject" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_authSubject_unique" UNIQUE("auth_subject")
);
--> statement-breakpoint
ALTER TABLE "decay_rules" ADD CONSTRAINT "decay_rules_node_id_rating_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_node_id_rating_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_node_id_rating_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_nodes" ADD CONSTRAINT "rating_nodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_nodes" ADD CONSTRAINT "rating_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_nodes" ADD CONSTRAINT "rating_nodes_parent_id_rating_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."rating_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decay_rules_node_id_index" ON "decay_rules" USING btree ("node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_node_id_index" ON "goals" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "llm_calls_user_id_created_at_index" ON "llm_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_sessions_season_id_index" ON "onboarding_sessions" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "rating_events_node_id_index" ON "rating_events" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "rating_events_season_id_index" ON "rating_events" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "rating_nodes_season_id_index" ON "rating_nodes" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_user_id_label_index" ON "seasons" USING btree ("user_id","label");
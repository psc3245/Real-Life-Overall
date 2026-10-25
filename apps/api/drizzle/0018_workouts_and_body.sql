CREATE TYPE "public"."body_kind" AS ENUM('weight', 'height');--> statement-breakpoint
CREATE TYPE "public"."exercise_category" AS ENUM('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body', 'cardio', 'sport', 'mobility', 'other');--> statement-breakpoint
CREATE TYPE "public"."exercise_tracking" AS ENUM('weight_reps', 'reps', 'duration', 'distance_duration', 'makes_attempts');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('imperial', 'metric');--> statement-breakpoint
ALTER TYPE "public"."objective_source" ADD VALUE 'workouts';--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"kind" "body_kind" NOT NULL,
	"value" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "exercise_category" NOT NULL,
	"tracking" "exercise_tracking" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"local_date" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"template_id" uuid,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unit_system" "unit_system" DEFAULT 'imperial' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_weight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_height" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurements_user_id_local_date_kind_index" ON "body_measurements" USING btree ("user_id","local_date","kind");--> statement-breakpoint
CREATE INDEX "exercises_user_id_index" ON "exercises" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_templates_user_id_index" ON "workout_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workouts_user_id_local_date_index" ON "workouts" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_one_in_progress" ON "workouts" USING btree ("user_id") WHERE "workouts"."ended_at" is null;
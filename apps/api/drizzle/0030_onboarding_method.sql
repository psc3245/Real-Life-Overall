CREATE TYPE "public"."onboarding_method" AS ENUM('scout', 'combine');--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD COLUMN "method" "onboarding_method" DEFAULT 'scout' NOT NULL;
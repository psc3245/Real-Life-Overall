ALTER TYPE "public"."onboarding_stage" ADD VALUE 'discovery' BEFORE 'tree';--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD COLUMN "discovery" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD COLUMN "template_rationale" text;
ALTER TABLE "seasons" ADD COLUMN "archetype_description" text;--> statement-breakpoint
-- Descriptions previously lived in the onboarding result.
UPDATE "seasons" s SET "archetype_description" = o."result"->>'archetypeDescription' FROM "onboarding_sessions" o WHERE o."season_id" = s."id" AND o."result" IS NOT NULL;

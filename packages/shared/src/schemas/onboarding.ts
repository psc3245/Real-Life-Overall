import { z } from "zod";
import {
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
} from "../constants";

export const ONBOARDING_STAGES = [
  "tree",
  "weights",
  "questionnaire",
  "followup",
  "rating",
  "complete",
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

const importance = z.number().int().min(IMPORTANCE_MIN).max(IMPORTANCE_MAX);

export interface RatingNodeDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  depth: number;
  weight: number;
  sortOrder: number;
  templateKey: string | null;
}

export interface SeasonDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  status: "setup" | "active" | "archived";
}

export interface OnboardingStateDto {
  stage: OnboardingStage;
  season: SeasonDto;
  priorities: string | null;
  weightRationale: string | null;
  /** Includes the Overall root (parentId null). Empty until the tree is first saved. */
  nodes: RatingNodeDto[];
}

// Request bodies

export const suggestAttributesBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_NODE_NAME_LENGTH),
  description: z.string().trim().max(MAX_NODE_DESCRIPTION_LENGTH).default(""),
  existing: z.array(z.string().max(MAX_NODE_NAME_LENGTH)).max(20).default([]),
});

export const suggestWeightsBodySchema = z.object({
  priorities: z.string().trim().max(1000).default(""),
});

export const saveWeightsBodySchema = z.object({
  weights: z
    .array(z.object({ nodeId: z.uuid(), weight: importance }))
    .min(1)
    .max(100),
});

// Responses

export interface AttributeSuggestionDto {
  name: string;
  description: string;
}

export interface WeightSuggestionDto {
  weights: { nodeId: string; weight: number }[];
  rationale: string;
}

// LLM outputs. Every field is required (nullable where optional) so the schemas work with
// providers' strict structured-output modes.

export const attributeSuggestionOutputSchema = z.object({
  attributes: z
    .array(
      z.object({
        name: z.string().describe(`Short attribute name, at most ${MAX_NODE_NAME_LENGTH} chars`),
        description: z.string().describe("One short sentence describing what it measures"),
      }),
    )
    .describe("3 to 5 attributes"),
});

export const weightSuggestionOutputSchema = z.object({
  weights: z.array(
    z.object({
      ref: z.string().describe("The node ref exactly as given, e.g. n3"),
      importance: z.number().describe("Integer 1-10, relative to the node's siblings"),
    }),
  ),
  rationale: z.string().describe("2-4 neutral sentences explaining the weighting"),
});

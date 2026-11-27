import { z } from 'zod';
import { ACTION_IDS } from './actions.js';

/**
 * Strips ASCII control characters (except tab, newline and carriage return) and trims
 * whitespace, so untrusted text cannot inject log lines or spoof prompt delimiters.
 */
export function sanitizePlainText(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

const plainText = (max: number) => z.string().max(max).transform(sanitizePlainText);

// ── Household profile ────────────────────────────────────────────────────────

export const vulnerableGroupSchema = z.enum([
  'infants',
  'children',
  'elderly',
  'asthma',
  'pregnant',
  'outdoor_workers',
]);
export const homeTypeSchema = z.enum(['apartment', 'independent_house', 'shared_housing']);
export const cookingFuelSchema = z.enum(['gas', 'induction_electric', 'biomass_solid']);
export const commuteModeSchema = z.enum([
  'car_petrol_diesel',
  'car_ev_hybrid',
  'public_transit',
  'two_wheeler',
  'walk_cycle',
  'remote',
]);
export const communityRoleSchema = z.enum(['family', 'school_pta', 'neighborhood_rwa']);
export const budgetTierSchema = z.enum(['low_cost', 'moderate', 'flexible']);

export const householdProfileSchema = z.object({
  householdSize: z.number().int().min(1).max(20),
  vulnerableGroups: z.array(vulnerableGroupSchema).max(6),
  homeType: homeTypeSchema,
  hasHepaPurifier: z.boolean(),
  cookingFuel: cookingFuelSchema,
  commuteMode: commuteModeSchema,
  dailyCommuteKm: z.number().min(0).max(250),
  communityRole: communityRoleSchema,
  budgetTier: budgetTierSchema,
});

// ── Location ─────────────────────────────────────────────────────────────────

export const cityLocationSchema = z.object({
  name: plainText(100).pipe(z.string().min(1)),
  country: plainText(80).pipe(z.string().min(1)),
  admin1: plainText(100).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: plainText(64).optional(),
});

// ── Request bodies & query strings ──────────────────────────────────────────

export const citySearchQuerySchema = z.object({
  q: plainText(80).pipe(z.string().min(2, 'Enter at least 2 characters to search a city')),
});

export const airQualityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: plainText(100).optional(),
  country: plainText(80).optional(),
});

export const actionPlanRequestSchema = z.object({
  location: cityLocationSchema,
  profile: householdProfileSchema,
  focusNote: plainText(240).optional(),
});

export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: plainText(1200).pipe(z.string().min(1)),
});

export const chatRequestSchema = z.object({
  location: cityLocationSchema,
  profile: householdProfileSchema,
  message: plainText(600).pipe(z.string().min(2, 'Please enter a question (at least 2 characters)')),
  history: z.array(chatTurnSchema).max(8).default([]),
});

export const impactSimulationRequestSchema = z.object({
  selectedActionIds: z.array(z.enum(ACTION_IDS)).max(ACTION_IDS.length),
  baselinePm25: z.number().min(0).max(1000),
  profile: householdProfileSchema,
  communityHouseholds: z.number().int().min(1).max(10_000),
});

// ── GenAI output contracts ──────────────────────────────────────────────────
// The model writes the words; impact figures are attached afterwards from the
// action catalog, so the schemas deliberately contain no numeric impact fields.

export const aiRecommendationSchema = z.object({
  actionId: z.enum(ACTION_IDS),
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(320),
  steps: z.array(z.string().min(4).max(220)).min(2).max(5),
  effort: z.enum(['quick_win', 'daily_habit', 'lifestyle_shift']),
  estimatedCost: z.string().min(1).max(50),
  bestTimeWindow: z.string().min(2).max(80),
  personalImpact: z.string().min(10).max(320),
  communityImpact: z.string().min(10).max(320),
});

export const aiPlanPayloadSchema = z.object({
  headline: z.string().min(5).max(160),
  briefing: z.string().min(20).max(600),
  alerts: z.array(z.string().min(5).max(220)).min(1).max(4),
  recommendations: z.array(aiRecommendationSchema).min(4).max(6),
  communityMessage: z.string().min(20).max(700),
});

export const aiChatPayloadSchema = z.object({
  reply: z.string().min(10).max(1800),
  keyTakeaways: z.array(z.string().min(4).max(180)).min(1).max(4),
  impactHighlight: z.string().min(8).max(260),
});

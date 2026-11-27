import { z } from 'zod';

/**
 * Strips ASCII control characters (except newline and tab) and trims whitespace
 * to prevent log injection and prompt delimiter spoofing.
 */
export function sanitizePlainText(input: string): string {
  let cleaned = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    const isDisallowedControl = (code >= 0 && code <= 31 && !isAllowedControl) || code === 127;
    if (!isDisallowedControl) {
      cleaned += input[i] ?? '';
    }
  }
  return cleaned.trim();
}

export const vulnerableGroupSchema = z.enum([
  'infants',
  'children',
  'elderly',
  'asthma',
  'pregnant',
  'outdoor_workers',
]);

export const homeTypeSchema = z.enum([
  'apartment',
  'independent_house',
  'shared_housing',
]);

export const cookingFuelSchema = z.enum([
  'gas',
  'induction_electric',
  'biomass_solid',
]);

export const commuteModeSchema = z.enum([
  'car_petrol_diesel',
  'car_ev_hybrid',
  'public_transit',
  'two_wheeler',
  'walk_cycle',
  'remote',
]);

export const communityRoleSchema = z.enum([
  'family',
  'school_pta',
  'neighborhood_rwa',
]);

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

export const cityLocationSchema = z.object({
  name: z.string().min(1).max(100).transform(sanitizePlainText),
  country: z.string().min(1).max(80).transform(sanitizePlainText),
  admin1: z.string().max(100).transform(sanitizePlainText).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().max(64).transform(sanitizePlainText).optional(),
});

export const citySearchQuerySchema = z.object({
  q: z
    .string()
    .min(2, 'Enter at least 2 characters to search a city')
    .max(80, 'City query is too long')
    .transform(sanitizePlainText)
    .refine((val) => val.length >= 2, 'Enter at least 2 valid characters'),
});

export const airQualityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z
    .string()
    .min(1)
    .max(100)
    .transform(sanitizePlainText)
    .optional(),
  country: z
    .string()
    .min(1)
    .max(80)
    .transform(sanitizePlainText)
    .optional(),
});

export const actionPlanRequestSchema = z.object({
  location: cityLocationSchema,
  profile: householdProfileSchema,
  focusNote: z
    .string()
    .max(240, 'Focus note must be 240 characters or fewer')
    .transform(sanitizePlainText)
    .optional(),
});

export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1200).transform(sanitizePlainText),
});

export const chatRequestSchema = z.object({
  location: cityLocationSchema,
  profile: householdProfileSchema,
  message: z
    .string()
    .min(2, 'Please enter a question (at least 2 characters)')
    .max(600, 'Question must be 600 characters or fewer')
    .transform(sanitizePlainText)
    .refine((v) => v.length >= 2, 'Please enter a valid question'),
  history: z.array(chatTurnSchema).max(8).default([]),
});

export const impactSimulationRequestSchema = z.object({
  selectedActionIds: z.array(z.string().min(1).max(60)).max(20),
  baselinePm25: z.number().min(1).max(1000),
  householdSize: z.number().int().min(1).max(20),
  communityHouseholds: z.number().int().min(1).max(10000),
});

/**
 * Strict schema used to validate structured JSON responses returned by GenAI models
 * before serving them to clients (defends against hallucinated structure or XSS payloads).
 */
export const aiRecommendationSchema = z.object({
  id: z.string().min(1).max(64),
  category: z.enum([
    'low_emission_routine',
    'indoor_air_hack',
    'sustainable_alternative',
    'community_action',
  ]),
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(320),
  steps: z.array(z.string().min(4).max(220)).min(2).max(5),
  effort: z.enum(['quick_win', 'daily_habit', 'lifestyle_shift']),
  estimatedCost: z.string().min(1).max(50),
  bestTimeWindow: z.string().min(2).max(80),
  impact: z.object({
    pm25ExposureReductionPct: z.number().min(0).max(95),
    weeklyCo2SavedKg: z.number().min(0).max(500),
    weeklyPm25AvoidedGrams: z.number().min(0).max(500),
    personalHealthExplanation: z.string().min(10).max(320),
    communityScaleExplanation: z.string().min(10).max(320),
  }),
});

export const aiPlanPayloadSchema = z.object({
  headline: z.string().min(5).max(160),
  winterSmogBriefing: z.string().min(20).max(600),
  urgentAlerts: z.array(z.string().min(5).max(220)).min(1).max(4),
  recommendations: z.array(aiRecommendationSchema).min(4).max(8),
  communityMessageTemplate: z.string().min(20).max(700),
});

export const aiChatPayloadSchema = z.object({
  reply: z.string().min(10).max(1800),
  keyTakeaways: z.array(z.string().min(4).max(180)).min(1).max(4),
  impactHighlight: z.string().min(8).max(260),
});

import type { ActionRecommendation, HouseholdProfile } from '../../../shared/types.js';

function buildCombustionSwap(profile: HouseholdProfile): ActionRecommendation {
  const hasRespiratoryRisk =
    profile.vulnerableGroups.includes('asthma') ||
    profile.vulnerableGroups.includes('elderly');
  const fuelLabel =
    profile.cookingFuel === 'biomass_solid' ? 'Solid/biomass cooking' : 'Gas burners';

  return {
    id: 'sustainable-clean-cooking',
    category: 'sustainable_alternative',
    title: 'Transition High-Heat Boiling & Simmering to Electric/Induction + Lid Cooking',
    summary: `${fuelLabel} inside winter-sealed homes create rapid spikes of NO₂ and ultrafine PM2.5 that linger for hours.`,
    steps: [
      'Use an electric kettle, rice cooker, or single-burner portable induction cooktop ($40–$70) for daily tea, boiling, and simmering.',
      'Always cook on rear burners with lids on and run your kitchen exhaust chimney/fan 5 minutes before and 10 minutes after cooking.',
      'Replace incense sticks, scented candles, and aerosol cleaners with baking soda/vinegar solutions and warm LED lamps during winter.',
    ],
    effort: 'lifestyle_shift',
    estimatedCost: '$0–$60 (portable induction)',
    bestTimeWindow: 'All meal prep times',
    impact: {
      pm25ExposureReductionPct: 28,
      weeklyCo2SavedKg: 6.5,
      weeklyPm25AvoidedGrams: 2.2,
      personalHealthExplanation: `Cuts indoor NO₂ peaks by up to 60% — especially protective for ${hasRespiratoryRisk ? 'asthma and respiratory sensitivity' : 'children’s developing lungs'} inside closed winter rooms.`,
      communityScaleExplanation:
        'Electrifying routine kitchen tasks across 200 apartments prevents over 5 metric tons of CO₂ per winter season and lowers local neighborhood exhaust.',
    },
  };
}

function buildLowVocCare(): ActionRecommendation {
  return {
    id: 'sustainable-low-voc-home',
    category: 'sustainable_alternative',
    title: 'Zero-Combustion Indoor Care & Low-VOC Winter Swaps',
    summary:
      'Your electric/induction kitchen already eliminates indoor gas NO₂ — lock in clean indoor air by removing hidden particle and VOC sources.',
    steps: [
      'Eliminate incense, paraffin candles, and aerosol room sprays; use simmering citrus peel or fragrance-free soap instead.',
      'Use a range hood or pan lids during high-heat sautéing/frying to trap cooking oil aerosols before they disperse.',
      'Line entryways with washable mats and enforce a shoes-off indoor rule to stop heavy metals and road dust from tracking onto floors.',
    ],
    effort: 'quick_win',
    estimatedCost: 'Saves $10/mo',
    bestTimeWindow: 'Daily home routine',
    impact: {
      pm25ExposureReductionPct: 20,
      weeklyCo2SavedKg: 3.0,
      weeklyPm25AvoidedGrams: 1.1,
      personalHealthExplanation:
        'Removes the top non-outdoor indoor pollution spikes (aerosols, incense, frying smoke) that commonly double indoor PM2.5 in sealed apartments.',
      communityScaleExplanation:
        'Switching to refillable, fragrance-free cleaners eliminates petroleum-based VOC precursors that contribute to urban smog formation.',
    },
  };
}

/**
 * Builds the sustainable indoor alternative recommendation tailored to cooking fuel type.
 */
export function buildCookingRecommendation(profile: HouseholdProfile): ActionRecommendation {
  const usesCombustion =
    profile.cookingFuel === 'gas' || profile.cookingFuel === 'biomass_solid';
  return usesCombustion ? buildCombustionSwap(profile) : buildLowVocCare();
}

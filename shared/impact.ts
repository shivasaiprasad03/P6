/**
 * Impact maths shared by the plan and the impact calculator. Every figure starts from
 * the action catalog (`actions.ts`), so the two views always agree.
 */
import { ACTION_CATALOG, resolveActionFigures, type ActionId } from './actions.js';
import { AIR_QUALITY_CONSTANTS } from './constants.js';
import type {
  ActionFigures,
  HouseholdProfile,
  ImpactSimulationRequest,
  ImpactSimulationResult,
  RecommendationCategory,
} from './types.js';

const {
  indoorInfiltrationFactor,
  maxCombinedExposureReductionPct,
  minIndoorPm25Floor,
  pm25PerCigaretteUgm3,
  daysPerMonth,
  co2KgPerTreePerMonth,
} = AIR_QUALITY_CONSTANTS;

/**
 * Combines independent exposure reductions multiplicatively: two 50% cuts leave
 * 25% of the dose (a 75% cut), not 100%. Capped so stacked estimates stay conservative.
 */
export function combineExposureReductions(percentages: readonly number[]): number {
  const remaining = percentages.reduce((left, pct) => left * (1 - Math.max(0, pct) / 100), 1);
  return Math.min(maxCombinedExposureReductionPct, Math.round((1 - remaining) * 100));
}

/** Typical indoor PM2.5 in an unfiltered home, given the outdoor level. */
export function estimateIndoorPm25(outdoorPm25: number): number {
  return Number(Math.max(minIndoorPm25Floor, outdoorPm25 * indoorInfiltrationFactor).toFixed(1));
}

/**
 * One-sentence, numbers-first description of what happens when `households` homes take
 * the same action. Used by recommendation cards and the rule-based advisor.
 */
export function describeCommunityScale(figures: ActionFigures, households: number): string {
  const co2 = Math.round(figures.monthlyCo2SavedKg * households);
  const pmKg = (figures.monthlyPm25AvoidedGrams * households) / 1000;
  if (co2 <= 0 && pmKg <= 0) {
    return `This protects the people in each home rather than cutting emissions, so ${households} households doing it means ${households} healthier homes, not cleaner streets.`;
  }
  const parts: string[] = [];
  if (co2 > 0) parts.push(`${co2.toLocaleString('en-US')} kg of CO₂`);
  if (pmKg > 0) parts.push(`${pmKg.toFixed(pmKg < 1 ? 2 : 1)} kg of PM2.5`);
  return `If ${households} households do this, together they avoid about ${parts.join(' and ')} a month.`;
}

/** Categories whose actions change the air inside the home (vs. time spent outside). */
const INDOOR_CATEGORIES: ReadonlySet<RecommendationCategory> = new Set([
  'indoor_air_hack',
  'sustainable_alternative',
]);

/**
 * Personal-dose sentence. Indoor actions are described as a drop in indoor PM2.5; outdoor
 * and community actions as a drop in the household's daily dose (people spend most of the
 * day indoors, so the dose is estimated from indoor levels). Both include the
 * cigarette-equivalents spared per person each week.
 */
export function describePersonalDose(
  figures: ActionFigures,
  outdoorPm25: number,
  category: RecommendationCategory,
): string {
  if (figures.exposureReductionPct === 0) {
    return 'Little change to your own exposure; the benefit is fewer emissions in your area.';
  }
  const before = estimateIndoorPm25(outdoorPm25);
  const after = Math.max(minIndoorPm25Floor, before * (1 - figures.exposureReductionPct / 100));
  const cigarettes = Math.max(0.1, ((before - after) / pm25PerCigaretteUgm3) * 7).toFixed(1);
  const pct = figures.exposureReductionPct;
  return INDOOR_CATEGORIES.has(category)
    ? `Cuts your indoor PM2.5 from about ${Math.round(before)} to ${Math.round(after)} µg/m³ (−${pct}%), roughly ${cigarettes} fewer cigarette-equivalents per person each week.`
    : `Cuts your household's daily PM2.5 dose by about ${pct}%, roughly ${cigarettes} fewer cigarette-equivalents per person each week.`;
}

/** `describePersonalDose` for a catalog action, tailored to the household. */
export function describeActionDose(id: ActionId, profile: HouseholdProfile, outdoorPm25: number): string {
  return describePersonalDose(resolveActionFigures(id, profile), outdoorPm25, ACTION_CATALOG[id].category);
}

/**
 * Calculates the combined effect of a set of actions for one household, and the
 * emissions avoided when `communityHouseholds` homes do the same.
 */
export function simulateImpact(request: ImpactSimulationRequest): ImpactSimulationResult {
  const ids = [...new Set<ActionId>(request.selectedActionIds)];
  const figures = ids.map((id) => resolveActionFigures(id, request.profile));
  const households = Math.max(1, request.communityHouseholds);

  const combinedPct = combineExposureReductions(figures.map((f) => f.exposureReductionPct));
  const indoorBefore = estimateIndoorPm25(request.baselinePm25);
  const indoorAfter = Number(
    Math.max(minIndoorPm25Floor, indoorBefore * (1 - combinedPct / 100)).toFixed(1),
  );

  const householdCo2 = figures.reduce((sum, f) => sum + f.monthlyCo2SavedKg, 0);
  const householdPm = figures.reduce((sum, f) => sum + f.monthlyPm25AvoidedGrams, 0);
  const monthlyCost = ids.reduce((sum, id) => sum + ACTION_CATALOG[id].monthlyCostDeltaUsd, 0);
  const communityCo2 = Number((householdCo2 * households).toFixed(1));

  return {
    selectedCount: ids.length,
    combinedExposureReductionPct: combinedPct,
    indoorPm25Before: indoorBefore,
    indoorPm25After: indoorAfter,
    avoidedCigarettesPerMonth: Math.round(
      ((indoorBefore - indoorAfter) / pm25PerCigaretteUgm3) * daysPerMonth * request.profile.householdSize,
    ),
    householdMonthlyCo2SavedKg: Number(householdCo2.toFixed(1)),
    householdMonthlyPm25AvoidedGrams: Number(householdPm.toFixed(1)),
    communityHouseholds: households,
    communityMonthlyCo2SavedKg: communityCo2,
    communityMonthlyPm25AvoidedKg: Number(((householdPm * households) / 1000).toFixed(2)),
    equivalentTrees: Math.max(0, Math.round(communityCo2 / co2KgPerTreePerMonth)),
    monthlySavingsUsd: Math.round(-monthlyCost),
  };
}

import { AIR_QUALITY_CONSTANTS, PLEDGE_ACTIONS } from '../../shared/constants.js';
import type { ImpactSimulationResult, PledgeActionItem } from '../../shared/types.js';

/**
 * Berkeley Earth rule-of-thumb: ~22 µg/m³ of 24-hour ambient PM2.5
 * corresponds roughly to the mortality risk of 1 cigarette per day.
 */
export function pm25ToCigaretteEquivalentPerDay(pm25: number): number {
  const safePm25 = Math.max(0, pm25);
  return Number((safePm25 / AIR_QUALITY_CONSTANTS.pm25PerCigaretteUgm3).toFixed(1));
}

function aggregateSelectedActions(selected: readonly PledgeActionItem[]) {
  let remainingExposureFactor = 1;
  let monthlyCo2SavedKg = 0;
  let monthlyPm25AvoidedGrams = 0;
  let monthlyCostDeltaUsd = 0;

  for (const action of selected) {
    const fraction = Math.min(
      AIR_QUALITY_CONSTANTS.maxSingleActionReductionFraction,
      Math.max(0, action.pm25ExposureReductionPct / 100),
    );
    remainingExposureFactor *= 1 - fraction;
    monthlyCo2SavedKg += action.monthlyCo2SavedKg;
    monthlyPm25AvoidedGrams += action.monthlyPm25AvoidedGrams;
    monthlyCostDeltaUsd += action.monthlyCostDeltaUsd;
  }

  const combinedReductionPct = Math.min(
    AIR_QUALITY_CONSTANTS.maxCombinedExposureReductionPct,
    Math.round((1 - remainingExposureFactor) * 100),
  );

  return {
    combinedReductionPct,
    monthlyCo2SavedKg,
    monthlyPm25AvoidedGrams,
    monthlyCostDeltaUsd,
  };
}

/**
 * Calculates combined personal health exposure reduction and community-scale
 * emissions impact for a selected set of household & community actions.
 *
 * Uses multiplicative independent abatement for PM2.5 exposure reduction
 * (`1 - Π(1 - r_i)`) capped conservatively at 88%.
 */
export function simulatePledgeImpact(params: {
  selectedActionIds: string[];
  baselinePm25: number;
  householdSize: number;
  communityHouseholds: number;
}): ImpactSimulationResult {
  const uniqueIds = new Set(params.selectedActionIds);
  const selected = PLEDGE_ACTIONS.filter((item) => uniqueIds.has(item.id));
  const totals = aggregateSelectedActions(selected);

  const unmitigatedIndoorPm25 = Math.max(
    5,
    params.baselinePm25 * AIR_QUALITY_CONSTANTS.indoorInfiltrationFactor,
  );
  const estimatedIndoorPm25After = Number(
    Math.max(
      AIR_QUALITY_CONSTANTS.minIndoorPm25Floor,
      unmitigatedIndoorPm25 * (1 - totals.combinedReductionPct / 100),
    ).toFixed(1),
  );

  const pm25SavedPerPerson = Math.max(0, unmitigatedIndoorPm25 - estimatedIndoorPm25After);
  const avoidedCigarettesPerMonth = Number(
    (
      (pm25SavedPerPerson / AIR_QUALITY_CONSTANTS.pm25PerCigaretteUgm3) *
      AIR_QUALITY_CONSTANTS.daysPerMonth *
      params.householdSize
    ).toFixed(0),
  );

  const communityHouseholds = Math.max(1, params.communityHouseholds);
  const communityMonthlyCo2SavedKg = Number(
    (totals.monthlyCo2SavedKg * communityHouseholds).toFixed(1),
  );
  const communityMonthlyPm25AvoidedKg = Number(
    ((totals.monthlyPm25AvoidedGrams * communityHouseholds) / 1000).toFixed(2),
  );

  return {
    selectedCount: selected.length,
    combinedPm25ExposureReductionPct: totals.combinedReductionPct,
    estimatedIndoorPm25After,
    avoidedCigarettesPerMonth,
    householdMonthlyCo2SavedKg: Number(totals.monthlyCo2SavedKg.toFixed(1)),
    householdMonthlyPm25AvoidedGrams: Number(totals.monthlyPm25AvoidedGrams.toFixed(1)),
    communityHouseholds,
    communityMonthlyCo2SavedKg,
    communityMonthlyPm25AvoidedKg,
    equivalentTreesPlanted: Math.round(
      communityMonthlyCo2SavedKg / AIR_QUALITY_CONSTANTS.co2KgPerTreePerMonth,
    ),
    estimatedMonthlySavingsUsd: Math.round(-totals.monthlyCostDeltaUsd),
  };
}

import { AIR_QUALITY_CONSTANTS } from '../../../shared/constants.js';
import type {
  ActionRecommendation,
  AirQualityReport,
  HouseholdProfile,
} from '../../../shared/types.js';

function buildDiyFilterRecommendation(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  const { current, location } = report;
  const hasKids =
    profile.vulnerableGroups.includes('children') ||
    profile.vulnerableGroups.includes('infants');
  const costLabel =
    profile.budgetTier === 'low_cost' ? '$45–$65 one-time (DIY)' : '$120–$220 HEPA or $55 DIY';
  const beforeIndoor = Math.round(current.pm25 * AIR_QUALITY_CONSTANTS.indoorInfiltrationFactor);
  const afterIndoor = Math.max(12, Math.round(current.pm25 * 0.31));
  const cigsSparedPerWeek = Math.max(
    1,
    Math.round(((current.pm25 * 0.34) / AIR_QUALITY_CONSTANTS.pm25PerCigaretteUgm3) * 7),
  );

  return {
    id: 'iaq-corsi-rosenthal',
    category: 'indoor_air_hack',
    title: 'Build a Bedroom Clean-Air Zone with a DIY Corsi-Rosenthal Box',
    summary: `Create a high-CADR filtration hub in your main sleeping room using four MERV-13 filters taped to a 20" box fan — critical while ${location.name} is at ${current.pm25} µg/m³ PM2.5.`,
    steps: [
      'Assemble 4 MERV-13 pleated filters into a cube with a cardboard base and tape a 20-inch box fan facing upward on top.',
      `Place it in the primary bedroom (especially for ${hasKids ? 'children/infants' : 'sleeping hours'}) and run on medium speed 45 minutes before bedtime.`,
      'Seal bedroom door gaps with a rolled damp towel or adhesive silicone weatherstripping during overnight inversion peaks.',
    ],
    effort: 'quick_win',
    estimatedCost: costLabel,
    bestTimeWindow: 'Evening through 9 AM (peak inversion)',
    impact: {
      pm25ExposureReductionPct: 52,
      weeklyCo2SavedKg: 1.0,
      weeklyPm25AvoidedGrams: 0.4,
      personalHealthExplanation: `Drops overnight bedroom PM2.5 from ~${beforeIndoor} µg/m³ to ~${afterIndoor} µg/m³, sparing lungs ~${cigsSparedPerWeek} cigarette-equivalents per person every week.`,
      communityScaleExplanation:
        'Sharing a 20-minute weekend DIY filter workshop with 25 neighbors equips low-income and elderly households with affordable clean air without waiting for retail purifiers.',
    },
  };
}

function buildHepaScheduleRecommendation(report: AirQualityReport): ActionRecommendation {
  const { safestWindow, inversionRisk, location } = report;
  const ventilationStep = safestWindow.ventilationSafe
    ? `Brief 10–15 minute cross-ventilation between ${safestWindow.startLabel} and ${safestWindow.endLabel} (avg AQI ${safestWindow.avgAqi}) to flush indoor CO₂.`
    : `Skip opening windows today (even the ${safestWindow.startLabel}–${safestWindow.endLabel} dip stays at AQI ${safestWindow.avgAqi}); rely on recirculation + wet-mopping.`;

  return {
    id: 'iaq-hepa-smart-schedule',
    category: 'indoor_air_hack',
    title: 'Optimize HEPA Placement & Timed Ventilation Window',
    summary: `Sync your existing HEPA purifier with ${location.name}'s diurnal smog dip (${safestWindow.startLabel}–${safestWindow.endLabel}) while eliminating indoor resuspension.`,
    steps: [
      `Keep windows tightly latched during ${inversionRisk.peakHours}; run HEPA on High for 20 minutes after cooking or returning home.`,
      ventilationStep,
      'Switch from dry broom sweeping to damp microfiber mopping and wipe HEPA pre-filters weekly during winter smog.',
    ],
    effort: 'daily_habit',
    estimatedCost: 'Free',
    bestTimeWindow: `${safestWindow.startLabel} – ${safestWindow.endLabel}`,
    impact: {
      pm25ExposureReductionPct: 38,
      weeklyCo2SavedKg: 2.2,
      weeklyPm25AvoidedGrams: 0.6,
      personalHealthExplanation:
        'Preventing dry-dust resuspension and timing purifier boosts cuts household fine-particle inhalation by up to 38% while keeping indoor CO₂ comfortable.',
      communityScaleExplanation:
        'Scheduling purifiers on auto/medium during low-smog hours trims winter peak grid load by ~18% across apartment blocks.',
    },
  };
}

/**
 * Builds the indoor air quality recommendation tailored to HEPA purifier ownership and budget.
 */
export function buildIndoorAirRecommendation(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  return profile.hasHepaPurifier
    ? buildHepaScheduleRecommendation(report)
    : buildDiyFilterRecommendation(report, profile);
}

import type {
  ActionRecommendation,
  AirQualityReport,
  HouseholdProfile,
} from '../../../shared/types.js';

const CO2_KG_PER_KM = 0.21;
const PM25_GRAMS_PER_KM = 0.048;
const SWAPPED_COMMUTE_DAYS_PER_WEEK = 3;

function buildFossilCommuteSwap(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  const { safestWindow, location } = report;
  const commuteKm = Math.max(4, profile.dailyCommuteKm);
  const weeklyCo2 = Number((commuteKm * CO2_KG_PER_KM * SWAPPED_COMMUTE_DAYS_PER_WEEK).toFixed(1));
  const weeklyPm = Number(
    (commuteKm * PM25_GRAMS_PER_KM * SWAPPED_COMMUTE_DAYS_PER_WEEK).toFixed(1),
  );
  const modeName =
    profile.commuteMode === 'car_petrol_diesel' ? 'petrol/diesel car' : 'two-wheeler';

  return {
    id: 'routine-low-emission-commute',
    category: 'low_emission_routine',
    title: 'Shift 3 High-Smog Commutes/Week to Transit, Carpool, or Hybrid Work',
    summary: `Your ${commuteKm} km daily ${modeName} trip adds cold-start exhaust directly into winter inversion layers.`,
    steps: [
      'Batch errands into a single midday trip during the safest dispersion window instead of cold-starting during morning smog.',
      'Coordinate a 3-family school or office carpool — or swap 3 days/week to metro/bus with a fitted N95/KF94 mask for last-mile walks.',
      'When driving is unavoidable, switch cabin HVAC to Recirculate and shut off the engine at stops over 30 seconds.',
    ],
    effort: 'daily_habit',
    estimatedCost: 'Saves $35–$65/mo',
    bestTimeWindow: `Avoid 7 AM–10 AM peak; travel near ${safestWindow.startLabel}–${safestWindow.endLabel}`,
    impact: {
      pm25ExposureReductionPct: 22,
      weeklyCo2SavedKg: weeklyCo2,
      weeklyPm25AvoidedGrams: weeklyPm,
      personalHealthExplanation:
        'Recirculated cabin air + fewer roadside rush-hour minutes reduces personal NO₂ and ultrafine soot exposure by 20–30%.',
      communityScaleExplanation: `If 100 households in ${location.name} adopt this swap, your neighborhood removes ~${Math.round(weeklyCo2 * 100)} kg CO₂ and ${((weeklyPm * 100) / 1000).toFixed(2)} kg of tailpipe PM2.5 weekly.`,
    },
  };
}

function buildCleanCommuteTiming(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  const { current, safestWindow } = report;
  const outdoorStep =
    current.usAqi >= 151
      ? 'Wear a tight-sealing N95/KF94 respirator outdoors and rinse face/nasal passages with saline after returning home.'
      : 'Monitor hourly AQI before intense outdoor exercise and shift cardio indoors whenever AQI exceeds 120.';

  return {
    id: 'routine-clean-transit-timing',
    category: 'low_emission_routine',
    title: 'Low-Exposure Routing & Smog-Window Scheduling',
    summary: `Protect your low-emission ${profile.commuteMode.replace('_', ' ')} routine by choosing side-street corridors and timing outdoor trips to the afternoon dip.`,
    steps: [
      `Schedule essential walks, school pickups, or outdoor errands close to ${safestWindow.startLabel}–${safestWindow.endLabel} when ambient PM2.5 dips to ~${safestWindow.avgPm25} µg/m³.`,
      'Choose tree-lined residential backstreets one block off arterial roads — roadside PM2.5 and NO₂ drop 30–50% just 50 meters away from heavy traffic.',
      outdoorStep,
    ],
    effort: 'daily_habit',
    estimatedCost: '$5–$10/mo (masks)',
    bestTimeWindow: `${safestWindow.startLabel} – ${safestWindow.endLabel}`,
    impact: {
      pm25ExposureReductionPct: 34,
      weeklyCo2SavedKg: 14.5,
      weeklyPm25AvoidedGrams: 3.4,
      personalHealthExplanation:
        'Side-street routing plus fit-checked N95 protection during smog alerts cuts inhaled black carbon and PM2.5 by over a third.',
      communityScaleExplanation:
        'Sustaining transit and active mobility prevents ~60 kg CO₂/month per household compared to urban car commuting, visibly lowering corridor haze.',
    },
  };
}

/**
 * Builds the low-emission daily routine recommendation tailored to household commute mode.
 */
export function buildCommuteRecommendation(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  const isFossilCommute =
    profile.commuteMode === 'car_petrol_diesel' || profile.commuteMode === 'two_wheeler';
  return isFossilCommute
    ? buildFossilCommuteSwap(report, profile)
    : buildCleanCommuteTiming(report, profile);
}

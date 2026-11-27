/**
 * The action catalog: the single source of truth for every impact figure in the app.
 *
 * Plans (rule-based or Gemini) pick actions from this list by id, and the impact
 * calculator sums the same entries, so a recommendation and the calculator can never
 * disagree. Figures are rough per-household estimates for a winter month, chosen to be
 * conservative; see README "How impact is estimated".
 */
import type { ActionDefinition, ActionFigures, CommuteMode, HouseholdProfile } from './types.js';

export const ACTION_IDS = [
  'diy-box-filter',
  'smart-ventilation',
  'wet-mop-draft-seal',
  'transit-carpool-swap',
  'low-exposure-routing',
  'clean-cooking',
  'low-voc-home',
  'fitted-masks',
  'zero-burn-anti-idling',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/** Commute distance the catalog's transit figures are quoted for. */
const REFERENCE_COMMUTE_KM = 24;
/** Days per week the transit swap replaces a solo trip. */
const SWAPPED_DAYS_PER_WEEK = 3;
const WEEKS_PER_MONTH = 4.33;

/** Per-km tailpipe + grid CO₂ and exhaust + brake/tyre PM2.5 by mode (rough averages). */
const COMMUTE_EMISSION_FACTORS: Record<CommuteMode, { co2KgPerKm: number; pm25GPerKm: number }> = {
  car_petrol_diesel: { co2KgPerKm: 0.19, pm25GPerKm: 0.012 },
  car_ev_hybrid: { co2KgPerKm: 0.09, pm25GPerKm: 0.008 },
  two_wheeler: { co2KgPerKm: 0.07, pm25GPerKm: 0.01 },
  public_transit: { co2KgPerKm: 0, pm25GPerKm: 0 },
  walk_cycle: { co2KgPerKm: 0, pm25GPerKm: 0 },
  remote: { co2KgPerKm: 0, pm25GPerKm: 0 },
};

export const ACTION_CATALOG: Readonly<Record<ActionId, ActionDefinition>> = {
  'diy-box-filter': {
    id: 'diy-box-filter',
    category: 'indoor_air_hack',
    title: 'Build a DIY box-fan filter for the bedroom',
    description:
      'Tape four MERV-13 furnace filters into a cube under a 20-inch box fan. It cleans a bedroom about as well as a HEPA purifier for a fraction of the price.',
    whyItWorks:
      'Lab and field tests of Corsi-Rosenthal boxes measure clean-air delivery rates of 400–600 CFM, which cuts bedroom PM2.5 by roughly half within 30 minutes.',
    exposureReductionPct: 45,
    // Runs a ~60 W fan most nights, so it adds a little CO₂ rather than saving it.
    monthlyCo2SavedKg: -8,
    monthlyPm25AvoidedGrams: 0,
    monthlyCostDeltaUsd: 8,
  },
  'smart-ventilation': {
    id: 'smart-ventilation',
    category: 'indoor_air_hack',
    title: 'Air the home only in the cleanest hours',
    description:
      'Keep windows shut through the night and morning, and open opposite windows for 10–15 minutes during the cleanest two-hour window of the day.',
    whyItWorks:
      'Winter inversions trap pollution near the ground from dusk until mid-morning; afternoon mixing often lowers outdoor PM2.5 by 25–40%.',
    exposureReductionPct: 20,
    monthlyCo2SavedKg: 0,
    monthlyPm25AvoidedGrams: 0,
    monthlyCostDeltaUsd: 0,
  },
  'wet-mop-draft-seal': {
    id: 'wet-mop-draft-seal',
    category: 'indoor_air_hack',
    title: 'Wet-mop floors and seal door and window gaps',
    description:
      'Swap dry sweeping for a damp microfibre mop, and close gaps with draught strips or a rolled towel.',
    whyItWorks:
      'Dry brooms kick settled dust back into the air, and leaky doors and windows let polluted air in. Sealing also keeps heat in, so heating uses less fuel.',
    exposureReductionPct: 15,
    monthlyCo2SavedKg: 10,
    monthlyPm25AvoidedGrams: 0,
    monthlyCostDeltaUsd: -3,
  },
  'transit-carpool-swap': {
    id: 'transit-carpool-swap',
    category: 'low_emission_routine',
    title: 'Swap three solo trips a week for transit or a carpool',
    description:
      'Take the metro or bus, or share school and office runs with other families, on three weekdays.',
    whyItWorks:
      'Short, cold-start city trips emit the most per km. Fewer of them means less exhaust and brake dust in your own street, and less time breathing traffic fumes inside a car.',
    exposureReductionPct: 10,
    monthlyCo2SavedKg: Math.round(
      REFERENCE_COMMUTE_KM * COMMUTE_EMISSION_FACTORS.car_petrol_diesel.co2KgPerKm * SWAPPED_DAYS_PER_WEEK * WEEKS_PER_MONTH,
    ),
    monthlyPm25AvoidedGrams: Number(
      (REFERENCE_COMMUTE_KM * COMMUTE_EMISSION_FACTORS.car_petrol_diesel.pm25GPerKm * SWAPPED_DAYS_PER_WEEK * WEEKS_PER_MONTH).toFixed(1),
    ),
    monthlyCostDeltaUsd: -45,
    scalesWithCommute: true,
  },
  'low-exposure-routing': {
    id: 'low-exposure-routing',
    category: 'low_emission_routine',
    title: 'Walk and cycle on side streets at the cleanest hours',
    description:
      'Plan walks, school runs and errands for the cleanest window, on quieter streets a block away from main roads.',
    whyItWorks:
      'Pollution from traffic drops sharply within 50–100 metres of a busy road, and the afternoon dip lowers the background level too.',
    exposureReductionPct: 20,
    monthlyCo2SavedKg: 0,
    monthlyPm25AvoidedGrams: 0,
    monthlyCostDeltaUsd: 0,
  },
  'clean-cooking': {
    id: 'clean-cooking',
    category: 'sustainable_alternative',
    title: 'Boil and simmer with electric or induction, lids on',
    description:
      'Use an electric kettle, rice cooker or a plug-in induction hob for everyday cooking, and run the extractor fan when frying.',
    whyItWorks:
      'Gas burners raise indoor NO₂, and solid fuels release large amounts of PM2.5, both trapped inside closed winter homes.',
    exposureReductionPct: 25,
    monthlyCo2SavedKg: 5,
    monthlyPm25AvoidedGrams: 2,
    monthlyCostDeltaUsd: -2,
  },
  'low-voc-home': {
    id: 'low-voc-home',
    category: 'sustainable_alternative',
    title: 'Stop burning incense and candles; use unscented cleaners',
    description:
      'Skip incense, paraffin candles and aerosol sprays in winter; clean with soap, vinegar or baking soda.',
    whyItWorks:
      'One incense stick or candle in a closed room can raise indoor PM2.5 by 50–120 µg/m³ and adds volatile organic compounds.',
    exposureReductionPct: 15,
    monthlyCo2SavedKg: 3,
    monthlyPm25AvoidedGrams: 1,
    monthlyCostDeltaUsd: -5,
  },
  'fitted-masks': {
    id: 'fitted-masks',
    category: 'low_emission_routine',
    title: 'Keep fitted N95 or KF94 masks by the door',
    description: 'Wear a well-fitted respirator for errands and commutes whenever the AQI is above 150.',
    whyItWorks:
      'Properly fitted N95/KF94 respirators filter 94–95% of fine particles; cloth and surgical masks filter far less.',
    exposureReductionPct: 30,
    monthlyCo2SavedKg: 0,
    monthlyPm25AvoidedGrams: 0,
    monthlyCostDeltaUsd: 10,
  },
  'zero-burn-anti-idling': {
    id: 'zero-burn-anti-idling',
    category: 'community_action',
    title: 'Agree a no-idling, no-burning pact with neighbours',
    description:
      'Switch engines off at school gates and long signals, compost leaves instead of burning them, and give night guards electric heaters instead of bonfires.',
    whyItWorks:
      'Idling queues and open burning of rubbish or leaves create the sharpest local PM2.5 spikes on still winter nights.',
    exposureReductionPct: 10,
    monthlyCo2SavedKg: 30,
    monthlyPm25AvoidedGrams: 25,
    monthlyCostDeltaUsd: 0,
  },
};

export const ACTION_LIST: readonly ActionDefinition[] = ACTION_IDS.map((id) => ACTION_CATALOG[id]);

const ZERO_FIGURES: ActionFigures = { exposureReductionPct: 0, monthlyCo2SavedKg: 0, monthlyPm25AvoidedGrams: 0 };

function commuteFigures(action: ActionDefinition, profile: HouseholdProfile): ActionFigures {
  const factor = COMMUTE_EMISSION_FACTORS[profile.commuteMode];
  if (factor.co2KgPerKm === 0 || profile.dailyCommuteKm === 0) return ZERO_FIGURES;
  const kmPerMonth = profile.dailyCommuteKm * SWAPPED_DAYS_PER_WEEK * WEEKS_PER_MONTH;
  return {
    exposureReductionPct: action.exposureReductionPct,
    monthlyCo2SavedKg: Math.round(kmPerMonth * factor.co2KgPerKm),
    monthlyPm25AvoidedGrams: Number((kmPerMonth * factor.pm25GPerKm).toFixed(1)),
  };
}

function cookingFigures(action: ActionDefinition, profile: HouseholdProfile): ActionFigures {
  if (profile.cookingFuel === 'induction_electric') return ZERO_FIGURES;
  if (profile.cookingFuel === 'biomass_solid') {
    // Solid-fuel stoves emit far more indoor smoke than gas.
    return { exposureReductionPct: 50, monthlyCo2SavedKg: 15, monthlyPm25AvoidedGrams: 100 };
  }
  return pickFigures(action);
}

function pickFigures(action: ActionDefinition): ActionFigures {
  return {
    exposureReductionPct: action.exposureReductionPct,
    monthlyCo2SavedKg: action.monthlyCo2SavedKg,
    monthlyPm25AvoidedGrams: action.monthlyPm25AvoidedGrams,
  };
}

/**
 * Tailors an action's reference figures to a household. An action that changes nothing
 * for this household (e.g. a transit swap for someone who already takes the metro)
 * returns zeros instead of claiming savings it cannot deliver.
 */
export function resolveActionFigures(id: ActionId, profile: HouseholdProfile): ActionFigures {
  const action = ACTION_CATALOG[id];
  if (action.scalesWithCommute) return commuteFigures(action, profile);
  if (id === 'clean-cooking') return cookingFigures(action, profile);
  if (id === 'diy-box-filter' && profile.hasHepaPurifier) return ZERO_FIGURES;
  return pickFigures(action);
}

export function isActionId(value: string): value is ActionId {
  return (ACTION_IDS as readonly string[]).includes(value);
}

import type {
  ActionRecommendation,
  AirQualityReport,
  CommunityRole,
  HouseholdProfile,
} from '../../../shared/types.js';

const PRIORITY_VULNERABLE_GROUPS = ['children', 'infants', 'asthma', 'elderly', 'pregnant'] as const;

function getRolePlaybook(
  role: CommunityRole,
  cityName: string,
  usAqi: number,
): { title: string; steps: string[] } {
  if (role === 'school_pta') {
    return {
      title: 'Activate School-Gate No-Idling & Smog-Adaptive Recess Protocol',
      steps: [
        'Establish a "Turn Off Engines" drop-off zone 100 meters from classrooms — school-gate idling spikes child-height NO₂ and PM2.5.',
        `Shift PE/recess indoors automatically whenever AQI exceeds 150 (currently ${usAqi} in ${cityName}) and run DIY Corsi-Rosenthal filters in classrooms.`,
        'Organize a parent-led walking bus or 4-family carpool roster for winter smog months.',
      ],
    };
  }
  if (role === 'neighborhood_rwa') {
    return {
      title: 'Deploy RWA Zero-Burn Guard Heater & Leaf-Composting Drive',
      steps: [
        'Provide electric oil-filled heaters and insulated jackets to overnight security guards to eliminate winter biomass/wood bonfires.',
        'Convert swept dry winter leaves into neighborhood compost pits rather than burning them.',
        'Set up a community bulk-buy for MERV-13 filters and N95 masks to cut per-family costs by 35–40%.',
      ],
    };
  }
  return {
    title: 'Launch a 5-Family School Carpool & Anti-Idling Circle',
    steps: [
      'Share today’s safest outdoor window with 3–5 neighboring families to coordinate shared school drop-offs and indoor playdates.',
      'Ask security staff and delivery riders to turn off idling engines near building lobbies and offer warm flasks/heaters instead of bonfires.',
      'Report illegal open garbage or leaf burning immediately to municipal pollution helplines.',
    ],
  };
}

/**
 * Builds the community-level collective action tailored to family, school PTA, or RWA role.
 */
export function buildCommunityRecommendation(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation {
  const { current, location } = report;
  const playbook = getRolePlaybook(profile.communityRole, location.name, current.usAqi);

  return {
    id: 'community-collective-shield',
    category: 'community_action',
    title: playbook.title,
    summary: `Multiply your household impact across ${location.name} by tackling hyperlocal winter smog hotspots (idling queues and open waste burning).`,
    steps: playbook.steps,
    effort: 'lifestyle_shift',
    estimatedCost: 'Low / Shared community budget',
    bestTimeWindow: 'Morning drop-off & evening patrol hours',
    impact: {
      pm25ExposureReductionPct: 16,
      weeklyCo2SavedKg: 9.5,
      weeklyPm25AvoidedGrams: 7.2,
      personalHealthExplanation:
        'Eliminating street-level idling and open fires right outside your building immediately stops acute smoky spikes entering lower-floor windows.',
      communityScaleExplanation:
        'Just 50 participating households preventing 1 evening bonfire and 150 idling trips per week eliminates >1.4 kg of localized PM2.5 and ~1.9 tons of CO₂ each month.',
    },
  };
}

/**
 * Builds an additional respiratory-protection card when sensitive household groups are present.
 */
export function buildVulnerableShieldRecommendation(
  report: AirQualityReport,
  profile: HouseholdProfile,
): ActionRecommendation | null {
  const hasPriorityGroup = PRIORITY_VULNERABLE_GROUPS.some((g) =>
    profile.vulnerableGroups.includes(g),
  );
  if (!hasPriorityGroup) return null;

  const { current, safestWindow } = report;
  const groupText = profile.vulnerableGroups.join(', ').replace(/_/g, ' ');

  return {
    id: 'health-vulnerable-shield',
    category: 'indoor_air_hack',
    title: `Priority Respiratory Shield for Sensitive Members (${groupText})`,
    summary: `Extra protective safeguards for your ${profile.householdSize}-person household while AQI is ${current.usAqi} (${current.label}).`,
    steps: [
      'Keep rescue inhalers, prescribed respiratory medications, and a simple indoor PM2.5/hygrometer check accessible in your clean-air room.',
      'Maintain indoor relative humidity between 40%–50% and hydrate well — dry winter air plus fine particulates irritates airways faster.',
      current.usAqi >= 201
        ? 'Cancel outdoor sports/playground time today; substitute low-dust indoor stretching or play inside your filtered room.'
        : `Limit children’s vigorous outdoor play to ${safestWindow.startLabel}–${safestWindow.endLabel} and watch for coughing or eye irritation.`,
    ],
    effort: 'quick_win',
    estimatedCost: 'Free',
    bestTimeWindow: 'Continuous during AQI > 100',
    impact: {
      pm25ExposureReductionPct: 30,
      weeklyCo2SavedKg: 0,
      weeklyPm25AvoidedGrams: 0.2,
      personalHealthExplanation:
        'Children breathe ~50% more air per kilogram of body weight than adults; protecting their sleep and play hours sharply lowers asthma flare-ups and school absences.',
      communityScaleExplanation:
        'Shared school and community air alerts cut emergency pediatric respiratory visits during severe winter smog episodes.',
    },
  };
}

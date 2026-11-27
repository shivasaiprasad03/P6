import type { ActionRecommendation, CommunityRole, VulnerableGroup } from '../../types.js';
import {
  buildRecommendation,
  hasChildren,
  hasSensitiveMembers,
  windowText,
  type AdvisorContext,
} from '../recommendation.js';

const PLAYBOOKS: Record<CommunityRole, { title: string; steps: (aqi: number) => string[] }> = {
  school_pta: {
    title: 'Set up a no-idling drop-off zone and an AQI rule for recess',
    steps: (aqi) => [
      'Mark an "engines off" drop-off point 100 m from the classrooms; idling at the gate puts exhaust at children’s breathing height.',
      `Agree with the school that PE and recess move indoors whenever the AQI is above 150 (it is ${aqi} now), with DIY box-fan filters in classrooms.`,
      'Organise a walking group or a four-family carpool rota for the winter months.',
    ],
  },
  neighborhood_rwa: {
    title: 'Run a no-burning drive: heaters for guards, compost for leaves',
    steps: () => [
      'Give overnight security guards electric heaters and warm jackets so they do not need wood or rubbish fires.',
      'Collect fallen leaves for a compost pit instead of burning them.',
      'Bulk-buy MERV-13 filters and N95 masks for the block; group orders usually cost about a third less.',
    ],
  },
  family: {
    title: 'Agree a no-idling, no-burning pact with neighbouring families',
    steps: () => [
      'Share today’s cleanest hours with three to five nearby families and plan shared school runs and indoor playdates.',
      'Ask drivers and delivery riders to switch engines off near your building entrance.',
      'Report open burning of rubbish or leaves to your city’s pollution helpline.',
    ],
  },
};

export function buildCommunityRecommendation(ctx: AdvisorContext): ActionRecommendation {
  const { report, profile } = ctx;
  const playbook = PLAYBOOKS[profile.communityRole];
  return buildRecommendation(ctx, 'zero-burn-anti-idling', {
    title: playbook.title,
    summary: `The worst local spikes in ${report.location.name} come from idling queues and open fires; these are things neighbours can stop together.`,
    steps: playbook.steps(report.current.usAqi),
    effort: 'lifestyle_shift',
    estimatedCost: 'Low, shared',
    bestTimeWindow: 'School runs and evenings',
  });
}

const GROUP_NAMES: Record<VulnerableGroup, string> = {
  infants: 'babies',
  children: 'children',
  elderly: 'older adults',
  asthma: 'people with asthma or COPD',
  pregnant: 'pregnant family members',
  outdoor_workers: 'outdoor workers',
};

/**
 * Masks and extra care: added when sensitive people live in the home, or when the air
 * is unhealthy for everyone (AQI above 150).
 */
export function buildProtectionRecommendation(ctx: AdvisorContext): ActionRecommendation | null {
  const { report, profile } = ctx;
  const { current } = report;
  if (!hasSensitiveMembers(profile) && current.usAqi <= 150) return null;

  const who = profile.vulnerableGroups.map((g) => GROUP_NAMES[g]).join(', ') || 'everyone at home';
  return buildRecommendation(ctx, 'fitted-masks', {
    title: `Extra protection for ${who}`,
    summary: `At AQI ${current.usAqi} (${current.label}), fine particles reach deep into the lungs.${
      hasChildren(profile) ? ' Children breathe more air per kg of body weight than adults, so they take in more.' : ''
    }`,
    steps: [
      'Keep fitted N95 or KF94 masks by the door (child sizes for children) and wear them for any trip outside.',
      current.usAqi >= 201
        ? 'Cancel outdoor sport today; do indoor play or stretching in your cleanest room instead.'
        : `Keep outdoor play and exercise to ${windowText(report)} and watch for coughing or sore eyes.`,
      'Keep inhalers and other prescribed medicines within reach, and keep indoor humidity around 40–50%.',
    ],
    effort: 'quick_win',
    estimatedCost: '$5–10 a month for masks',
    bestTimeWindow: 'Whenever AQI is above 150',
  });
}

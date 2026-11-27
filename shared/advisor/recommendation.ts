import { ACTION_CATALOG, resolveActionFigures, type ActionId } from '../actions.js';
import { describeCommunityScale, describePersonalDose } from '../impact.js';
import type { ActionRecommendation, AirQualityReport, HouseholdProfile } from '../types.js';

/** Neighbourhood size used when explaining community-scale impact. */
export const COMMUNITY_SCALE_HOUSEHOLDS = 100;

export interface AdvisorContext {
  report: AirQualityReport;
  profile: HouseholdProfile;
}

export type RecommendationCopy = Pick<
  ActionRecommendation,
  'title' | 'summary' | 'steps' | 'effort' | 'estimatedCost' | 'bestTimeWindow'
> & {
  /** Optional sentence appended to the computed personal-impact line. */
  personalNote?: string;
};

/**
 * Turns an action from the catalog plus advice wording into a recommendation. The impact
 * figures and the impact sentences are always computed here from the catalog, never
 * written by hand, so they match the impact calculator exactly.
 */
export function buildRecommendation(
  { report, profile }: AdvisorContext,
  actionId: ActionId,
  copy: RecommendationCopy,
): ActionRecommendation {
  const figures = resolveActionFigures(actionId, profile);
  const { category } = ACTION_CATALOG[actionId];
  const { personalNote, ...content } = copy;
  const personal = describePersonalDose(figures, report.current.pm25, category);
  return {
    actionId,
    category,
    ...content,
    figures,
    personalImpact: personalNote ? `${personal} ${personalNote}` : personal,
    communityImpact: describeCommunityScale(figures, COMMUNITY_SCALE_HOUSEHOLDS),
  };
}

const SENSITIVE_GROUPS = ['infants', 'children', 'elderly', 'asthma', 'pregnant'] as const;

export function hasSensitiveMembers(profile: HouseholdProfile): boolean {
  return SENSITIVE_GROUPS.some((g) => profile.vulnerableGroups.includes(g));
}

export function hasChildren(profile: HouseholdProfile): boolean {
  return profile.vulnerableGroups.includes('children') || profile.vulnerableGroups.includes('infants');
}

export function windowText(report: AirQualityReport): string {
  return `${report.safestWindow.startLabel}–${report.safestWindow.endLabel}`;
}

import { SAFETY_DISCLAIMER } from '../../shared/constants.js';
import type {
  ActionPlanResponse,
  ActionRecommendation,
  AirQualityReport,
  HouseholdProfile,
} from '../../shared/types.js';
import {
  buildCommunityRecommendation,
  buildVulnerableShieldRecommendation,
} from './builders/community.js';
import { buildCommuteRecommendation } from './builders/commute.js';
import { buildCookingRecommendation } from './builders/cooking.js';
import { buildIndoorAirRecommendation } from './builders/indoorAir.js';

function buildUrgentAlerts(
  report: AirQualityReport,
  profile: HouseholdProfile,
  focusNote?: string,
): string[] {
  const { current } = report;
  const alerts: string[] = [];

  if (current.usAqi >= 201) {
    alerts.push(
      `Severe Winter Smog Alert (${current.usAqi} US AQI · ${current.pm25} µg/m³ PM2.5): Keep windows sealed, run indoor filtration, and wear fitted N95/KF94 masks outdoors.`,
    );
  } else if (current.usAqi >= 101) {
    alerts.push(
      `Elevated Pollution (${current.usAqi} US AQI): Sensitive family members should move vigorous activity indoors and avoid morning inversion peaks.`,
    );
  } else {
    alerts.push(
      `Favorable Window (${current.usAqi} US AQI): Great time to cross-ventilate your home and enjoy low-emission outdoor errands.`,
    );
  }

  if (!profile.hasHepaPurifier && current.usAqi >= 151) {
    alerts.push(
      'No HEPA purifier detected in your profile: Prioritize a low-cost DIY Corsi-Rosenthal MERV-13 filter for bedrooms tonight.',
    );
  }

  if (focusNote) {
    alerts.push(`Custom household focus noted: "${focusNote}" — factored into your daily priorities.`);
  }

  return alerts;
}

function buildCommunityBroadcast(report: AirQualityReport): string {
  const { location, current, safestWindow } = report;
  const ventTip = safestWindow.ventilationSafe
    ? 'Brief 10-min cross-ventilation in the afternoon dip, then close windows before dusk.'
    : 'Keep windows sealed today, wet-mop instead of sweeping, and run HEPA or DIY MERV-13 filtration.';

  return [
    `🌫️ ${location.name} Air Quality Brief (AQI ${current.usAqi} — ${current.label}, PM2.5: ${current.pm25} µg/m³)`,
    `• Best low-smog window today: ${safestWindow.startLabel}–${safestWindow.endLabel} (avg AQI ${safestWindow.avgAqi}).`,
    `• Household tip: ${ventTip}`,
    '• Community pledge: Turn off car engines at gates/signals (>30s), carpool where possible, and keep our block 100% free of leaf/waste burning. Every family counts!',
  ].join('\n');
}

/**
 * Deterministic domain intelligence engine assembling tailored winter-smog action plans
 * grounded in live AQI, household sensitivities, home setup, and commute profile.
 */
export function buildLocalActionPlan(
  report: AirQualityReport,
  profile: HouseholdProfile,
  focusNote?: string,
): ActionPlanResponse {
  const { current, safestWindow, inversionRisk, location } = report;
  const recommendations: ActionRecommendation[] = [
    buildIndoorAirRecommendation(report, profile),
    buildCommuteRecommendation(report, profile),
    buildCookingRecommendation(profile),
    buildCommunityRecommendation(report, profile),
  ];

  const vulnerableRec = buildVulnerableShieldRecommendation(report, profile);
  if (vulnerableRec) {
    recommendations.push(vulnerableRec);
  }

  const headline =
    current.usAqi >= 201
      ? `Severe Winter Smog Protocol for Your ${location.name} Household`
      : current.usAqi >= 151
        ? `High-Smog Protection & Low-Emission Plan for ${location.name}`
        : `Clean-Air & Low-Emission Daily Playbook for ${location.name}`;

  return {
    generatedAt: new Date().toISOString(),
    engine: 'local-intelligence',
    modelUsed: 'breathesafe-rules-v1',
    cached: false,
    headline,
    winterSmogBriefing: `${location.name} is currently at US AQI ${current.usAqi} (${current.label}) with PM2.5 at ${current.pm25} µg/m³ (~${current.cigaretteEquivalentPerDay} cigarette-equivalents/day outdoors). ${inversionRisk.summary} Your lowest-pollution window in the next 24h is ${safestWindow.startLabel}–${safestWindow.endLabel} (avg AQI ${safestWindow.avgAqi}).`,
    urgentAlerts: buildUrgentAlerts(report, profile, focusNote),
    recommendations,
    communityMessageTemplate: buildCommunityBroadcast(report),
    safetyDisclaimer: SAFETY_DISCLAIMER,
  };
}

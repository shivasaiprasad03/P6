/**
 * Rule-based plan engine. Runs when Gemini is not configured or fails, and powers the
 * static build. Every recommendation comes from the action catalog via the builders.
 */
import { classifyAqi, SAFETY_DISCLAIMER } from '../constants.js';
import type { ActionPlanResponse, ActionRecommendation, AirQualityReport, HourlyAirPoint } from '../types.js';
import { buildCommuteRecommendation } from './builders/commute.js';
import { buildCommunityRecommendation, buildProtectionRecommendation } from './builders/community.js';
import { buildCookingRecommendation } from './builders/cooking.js';
import { buildIndoorAirRecommendation } from './builders/indoorAir.js';
import { hasSensitiveMembers, windowText, type AdvisorContext } from './recommendation.js';

export const RULES_ENGINE_VERSION = 'breathesafe-rules-v2';

const TIME_IN_NOTE = /\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b/i;

/** Finds the forecast hour a note refers to, e.g. "football practice at 4 pm". */
export function findHourInNote(note: string, forecast: readonly HourlyAirPoint[]): HourlyAirPoint | null {
  const match = TIME_IN_NOTE.exec(note);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  const label = `${hour} ${match[2]!.toUpperCase()}`;
  return forecast.find((point) => point.hourLabel === label) ?? null;
}

/** Turns the household's note into a concrete check against the forecast, when it names a time. */
export function adviceForNote(note: string, report: AirQualityReport): string | null {
  const point = findHourInNote(note, report.hourlyForecast);
  if (!point) return null;
  const band = classifyAqi(point.usAqi);
  const nearCleanest = point.usAqi <= report.safestWindow.avgAqi + 15;
  let verdict: string;
  if (point.usAqi <= 100) {
    verdict = 'that is fine for outdoor activity.';
  } else if (point.usAqi > 150) {
    verdict = nearCleanest
      ? 'even the cleanest hours today are unhealthy for hard exercise, so move it indoors or keep it short and light.'
      : `that is unhealthy for hard exercise; move it indoors, or to ${windowText(report)} (average AQI ${report.safestWindow.avgAqi}) and keep it light.`;
  } else {
    verdict = nearCleanest
      ? 'that is close to the cleanest time today, so keep it but skip the hardest exertion.'
      : `consider moving it to ${windowText(report)} (average AQI ${report.safestWindow.avgAqi}).`;
  }
  return `About "${note}": at ${point.hourLabel} the forecast is AQI ${point.usAqi} (${band.label}); ${verdict}`;
}

function buildAlerts({ report, profile }: AdvisorContext, focusNote?: string): string[] {
  const { current } = report;
  const alerts: string[] = [];

  if (current.usAqi >= 201) {
    alerts.push(
      `Severe smog (AQI ${current.usAqi}, PM2.5 ${current.pm25} µg/m³): keep windows shut, run filtration, and wear a fitted N95 or KF94 outdoors.`,
    );
  } else if (current.usAqi >= 101) {
    alerts.push(
      `Unhealthy air (AQI ${current.usAqi}): ${hasSensitiveMembers(profile) ? 'sensitive family members' : 'anyone sensitive'} should move hard exercise indoors and avoid the morning peak.`,
    );
  } else {
    alerts.push(`Air is ${current.label.toLowerCase()} (AQI ${current.usAqi}): a good time to air out the home and walk instead of drive.`);
  }

  if (!profile.hasHepaPurifier && current.usAqi >= 151) {
    alerts.push('You have no purifier: set up a DIY box-fan filter in the bedroom tonight (about $50).');
  }

  const noteAdvice = focusNote ? adviceForNote(focusNote, report) : null;
  if (noteAdvice) alerts.push(noteAdvice);

  return alerts;
}

function buildCommunityMessage(report: AirQualityReport): string {
  const { location, current, safestWindow } = report;
  const airing = safestWindow.ventilationSafe
    ? `Air out your home for 10 minutes around ${windowText(report)}, then close the windows before dusk.`
    : 'Keep windows shut today, wet-mop instead of sweeping, and run any purifier or DIY filter you have.';

  return [
    `${location.name} air today: AQI ${current.usAqi} (${current.label}), PM2.5 ${current.pm25} µg/m³.`,
    `• Cleanest time to be outside: ${windowText(report)} (average AQI ${safestWindow.avgAqi}).`,
    `• At home: ${airing}`,
    '• Together: switch engines off when waiting, share school runs, and no burning of leaves or rubbish on our street.',
  ].join('\n');
}

function headlineFor(report: AirQualityReport): string {
  const { current, location } = report;
  if (current.usAqi >= 201) return `Severe smog plan for your ${location.name} home`;
  if (current.usAqi >= 151) return `Unhealthy-air plan for ${location.name}`;
  if (current.usAqi >= 101) return `A protective day plan for ${location.name}`;
  return `A clean-air day plan for ${location.name}`;
}

/**
 * Builds a plan tailored to the readings and the household: one indoor-air action,
 * one travel action, one cooking action, one community action, and extra protection
 * when someone sensitive lives there or the air is unhealthy for everyone.
 */
export function buildRulesPlan(
  report: AirQualityReport,
  profile: AdvisorContext['profile'],
  focusNote?: string,
): ActionPlanResponse {
  const ctx: AdvisorContext = { report, profile };
  const { current, inversionRisk, location, safestWindow } = report;

  const protection = buildProtectionRecommendation(ctx);
  const recommendations: ActionRecommendation[] = [
    buildIndoorAirRecommendation(ctx),
    buildCommuteRecommendation(ctx),
    buildCookingRecommendation(ctx),
    buildCommunityRecommendation(ctx),
    ...(protection ? [protection] : []),
  ];

  return {
    generatedAt: new Date().toISOString(),
    engine: 'rules',
    modelUsed: RULES_ENGINE_VERSION,
    cached: false,
    headline: headlineFor(report),
    briefing: `${location.name} is at AQI ${current.usAqi} (${current.label}) with PM2.5 at ${current.pm25} µg/m³, about ${current.cigaretteEquivalentPerDay} cigarettes' worth if breathed all day. ${inversionRisk.summary} The cleanest two hours in the next day are ${windowText(report)} (average AQI ${safestWindow.avgAqi}).`,
    alerts: buildAlerts(ctx, focusNote),
    recommendations,
    communityMessage: buildCommunityMessage(report),
    safetyDisclaimer: SAFETY_DISCLAIMER,
  };
}

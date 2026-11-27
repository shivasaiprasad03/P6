import type { ActionRecommendation } from '../../types.js';
import { buildRecommendation, hasChildren, windowText, type AdvisorContext } from '../recommendation.js';

/** No purifier yet: the cheapest effective fix is a DIY box-fan filter in the bedroom. */
function diyFilter(ctx: AdvisorContext): ActionRecommendation {
  const { report, profile } = ctx;
  return buildRecommendation(ctx, 'diy-box-filter', {
    title: 'Make the bedroom a clean-air room with a DIY box-fan filter',
    summary: `With outdoor PM2.5 at ${report.current.pm25} µg/m³ in ${report.location.name}, the room you sleep in matters most. Four MERV-13 filters and a box fan clean it about as well as a HEPA purifier.`,
    steps: [
      'Tape four 20×20-inch MERV-13 filters into a cube (arrows pointing in), add a cardboard base, and tape a 20-inch box fan on top blowing upwards.',
      `Run it on medium in the main bedroom${hasChildren(profile) ? ', where the children sleep,' : ''} from 45 minutes before bedtime until morning.`,
      'Close the bedroom door and block the gap underneath with a rolled towel overnight.',
    ],
    effort: 'quick_win',
    estimatedCost: profile.budgetTier === 'low_cost' ? '$45–65 one-off' : '$45–65 DIY or $120+ HEPA',
    bestTimeWindow: 'Evening until mid-morning, when smog is trapped',
    personalNote: 'It runs a small fan, so it adds a few kg of CO₂ a month; worth it for the health benefit.',
  });
}

/** Already owns a purifier: get more out of it by timing it and the windows. */
function purifierSchedule(ctx: AdvisorContext): ActionRecommendation {
  const { report } = ctx;
  const { safestWindow, inversionRisk } = report;
  return buildRecommendation(ctx, 'smart-ventilation', {
    title: 'Time your purifier and windows around the clean hours',
    summary: `Keep the home sealed while smog is trapped (${inversionRisk.peakHours}) and only let fresh air in around ${windowText(report)}.`,
    steps: [
      'Keep windows shut through the evening and morning; run the purifier on high for 20 minutes after cooking or coming home.',
      safestWindow.ventilationSafe
        ? `Open opposite windows for 10–15 minutes between ${windowText(report)} (average AQI ${safestWindow.avgAqi}), then close them.`
        : `Skip airing out today: even the cleanest hours (${windowText(report)}) average AQI ${safestWindow.avgAqi}.`,
      'Wipe the purifier pre-filter weekly in winter so airflow stays high.',
    ],
    effort: 'daily_habit',
    estimatedCost: 'Free',
    bestTimeWindow: windowText(report),
  });
}

export function buildIndoorAirRecommendation(ctx: AdvisorContext): ActionRecommendation {
  return ctx.profile.hasHepaPurifier ? purifierSchedule(ctx) : diyFilter(ctx);
}

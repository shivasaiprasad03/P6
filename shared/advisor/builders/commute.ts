import { resolveActionFigures } from '../../actions.js';
import type { ActionRecommendation, CommuteMode } from '../../types.js';
import { buildRecommendation, windowText, type AdvisorContext } from '../recommendation.js';

const MODE_NAMES: Record<CommuteMode, string> = {
  car_petrol_diesel: 'petrol or diesel car',
  car_ev_hybrid: 'electric or hybrid car',
  two_wheeler: 'motorbike or scooter',
  public_transit: 'metro or bus',
  walk_cycle: 'walk or cycle',
  remote: 'mostly stay at home',
};

/** Drives: swapping some trips cuts both local emissions and in-vehicle exposure. */
function transitSwap(ctx: AdvisorContext): ActionRecommendation {
  const { report, profile } = ctx;
  return buildRecommendation(ctx, 'transit-carpool-swap', {
    title: 'Swap three car or scooter trips a week for transit or a carpool',
    summary: `Your ${profile.dailyCommuteKm} km round trip by ${MODE_NAMES[profile.commuteMode]} adds exhaust right into the layer of trapped winter air you breathe.`,
    steps: [
      'Pick three weekdays to take the metro or bus, or share the school or office run with two other families.',
      `Group errands into one trip around ${windowText(report)} instead of several cold starts in the morning smog.`,
      'When you do drive, set the air to recirculate and switch the engine off at stops longer than 30 seconds.',
    ],
    effort: 'daily_habit',
    estimatedCost: 'Saves $35–65 a month',
    bestTimeWindow: `Avoid 7–10 AM; travel near ${windowText(report)}`,
  });
}

/** Already travels cleanly: protect yourself with route and timing choices. */
function lowExposureRouting(ctx: AdvisorContext): ActionRecommendation {
  const { report, profile } = ctx;
  const { current, safestWindow } = report;
  return buildRecommendation(ctx, 'low-exposure-routing', {
    title: 'Take quieter streets at the cleanest hours',
    summary: `You already ${MODE_NAMES[profile.commuteMode]}, which keeps emissions down. Now cut what you breathe on the way.`,
    steps: [
      `Plan walks, school pickups and errands for ${windowText(report)}, when PM2.5 is about ${safestWindow.avgPm25} µg/m³.`,
      'Walk or cycle one block away from main roads; traffic pollution drops sharply within 50–100 m.',
      current.usAqi >= 151
        ? 'Wear a fitted N95 or KF94 outdoors today, and rinse your face when you get home.'
        : 'Move hard exercise indoors whenever the AQI goes above 120.',
    ],
    effort: 'daily_habit',
    estimatedCost: 'Free',
    bestTimeWindow: windowText(report),
  });
}

export function buildCommuteRecommendation(ctx: AdvisorContext): ActionRecommendation {
  const swapHelps = resolveActionFigures('transit-carpool-swap', ctx.profile).monthlyCo2SavedKg > 0;
  return swapHelps ? transitSwap(ctx) : lowExposureRouting(ctx);
}

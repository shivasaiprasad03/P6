import type { ActionRecommendation } from '../../types.js';
import { buildRecommendation, type AdvisorContext } from '../recommendation.js';

/** Gas or solid fuel: move everyday boiling and simmering to electric. */
function cleanCooking(ctx: AdvisorContext): ActionRecommendation {
  const solidFuel = ctx.profile.cookingFuel === 'biomass_solid';
  return buildRecommendation(ctx, 'clean-cooking', {
    title: 'Move everyday boiling and simmering to electric or induction',
    summary: solidFuel
      ? 'Wood, coal and dung stoves fill a closed winter home with smoke; for many families this is a bigger source of PM2.5 than the street outside.'
      : 'Gas burners release NO₂ and fine particles that build up in a sealed winter kitchen and linger for hours.',
    steps: [
      'Use an electric kettle, rice cooker or a plug-in induction hob ($40–70) for tea, rice, boiling and simmering.',
      'Cook with lids on, use the back burners, and run the extractor fan from 5 minutes before until 10 minutes after cooking.',
      solidFuel
        ? 'If you must use the solid-fuel stove, cook near an open window or door and keep children out of the kitchen.'
        : 'Keep a window in the kitchen slightly open while frying, even in winter.',
    ],
    effort: 'lifestyle_shift',
    estimatedCost: '$0–70 one-off',
    bestTimeWindow: 'Every meal',
  });
}

/** Already cooks electric: remove the remaining indoor smoke sources. */
function lowVocHome(ctx: AdvisorContext): ActionRecommendation {
  return buildRecommendation(ctx, 'low-voc-home', {
    title: 'Cut the last indoor smoke sources: incense, candles and sprays',
    summary:
      'Electric cooking already keeps gas fumes out of your home. Incense, candles and aerosol sprays are now the main sources of indoor smoke left.',
    steps: [
      'Skip incense, paraffin candles and air-freshener sprays while windows are kept shut for winter.',
      'Clean with unscented soap, vinegar or baking soda instead of aerosol products.',
      'Use pan lids and the extractor fan when frying to stop oil smoke spreading.',
    ],
    effort: 'quick_win',
    estimatedCost: 'Saves about $5 a month',
    bestTimeWindow: 'Daily',
  });
}

export function buildCookingRecommendation(ctx: AdvisorContext): ActionRecommendation {
  return ctx.profile.cookingFuel === 'induction_electric' ? lowVocHome(ctx) : cleanCooking(ctx);
}

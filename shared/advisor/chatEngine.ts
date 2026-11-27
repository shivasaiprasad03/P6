/**
 * Rule-based question answering. Matches the question to a topic and answers from the
 * current readings, the household profile and the action catalog. Used when Gemini is
 * unavailable, in the static build, and for any message that looks like prompt injection.
 */
import { resolveActionFigures, type ActionId } from '../actions.js';
import { SAFETY_DISCLAIMER } from '../constants.js';
import { describeActionDose, describeCommunityScale } from '../impact.js';
import type { AirQualityReport, ChatResponse, HouseholdProfile } from '../types.js';
import { RULES_ENGINE_VERSION } from './planEngine.js';
import { detectPromptInjection } from './promptGuard.js';
import { COMMUNITY_SCALE_HOUSEHOLDS, hasChildren, windowText } from './recommendation.js';

type Answer = Pick<ChatResponse, 'reply' | 'keyTakeaways' | 'impactHighlight'>;

interface Topic {
  /** Whole words (plus -s/-es/-ing forms); a trailing `*` marks a stem. */
  keywords: readonly string[];
  answer: (report: AirQualityReport, profile: HouseholdProfile) => Answer;
}

function personalImpact(id: ActionId, report: AirQualityReport, profile: HouseholdProfile): string {
  return describeActionDose(id, profile, report.current.pm25);
}

const TOPICS: readonly Topic[] = [
  {
    keywords: ['diy', 'purifier', 'filter', 'corsi', 'hepa', 'budget', 'cheap*'],
    answer: (report, profile) => ({
      reply: profile.hasHepaPurifier
        ? `You already have a HEPA purifier, so use it well: run it on high in the room you sleep in from an hour before bed, keep that door closed, and wipe the pre-filter weekly. With outdoor PM2.5 at ${report.current.pm25} µg/m³ in ${report.location.name}, keep windows shut except around ${windowText(report)}.`
        : `The best-value fix is a DIY box-fan filter. Tape four 20×20-inch MERV-13 furnace filters into a cube (arrows pointing in), add a cardboard base, and tape a 20-inch box fan on top blowing upwards. Run it on medium in the bedroom from 45 minutes before bedtime.`,
      keyTakeaways: [
        'Costs about $45–65, against $200+ for a purifier with similar airflow.',
        'Replace the filters when they turn dark grey, usually every 4–6 months.',
        'Close the bedroom door and block the gap underneath overnight.',
      ],
      impactHighlight: personalImpact(profile.hasHepaPurifier ? 'smart-ventilation' : 'diy-box-filter', report, profile),
    }),
  },
  {
    keywords: ['kid', 'child*', 'school', 'play', 'outside', 'outdoor*', 'walk', 'run', 'jog*', 'exercis*'],
    answer: (report, profile) => {
      const { current, location, safestWindow } = report;
      const who = hasChildren(profile) ? 'the children' : 'you';
      return {
        reply:
          current.usAqi <= 100
            ? `${location.name} is at AQI ${current.usAqi} (${current.label}), which is fine for outdoor play and exercise. Choose parks or side streets away from main roads.`
            : `At AQI ${current.usAqi} (${current.label}), hard exercise or long play outside isn't a good idea for ${who} right now; children breathe more air per kg of body weight than adults. Keep active play indoors, ideally near a filter. If ${who} must go out, aim for ${windowText(report)} (average AQI ${safestWindow.avgAqi}) and use fitted child-size KF94 or N95 masks.`,
        keyTakeaways: [
          `Cleanest time today: ${windowText(report)} (PM2.5 about ${safestWindow.avgPm25} µg/m³).`,
          'Avoid 7–10 AM and after dark, when winter smog is trapped near the ground.',
          'Share the school run with other families to cut exhaust at the gate.',
        ],
        impactHighlight: personalImpact('low-exposure-routing', report, profile),
      };
    },
  },
  {
    keywords: ['window', 'ventilat*', 'air out', 'fresh air', 'cook*', 'kitchen', 'stove', 'gas'],
    answer: (report, profile) => {
      const { location, safestWindow } = report;
      const kitchen =
        profile.cookingFuel === 'induction_electric'
          ? 'In the kitchen, use lids and the extractor fan when frying.'
          : 'In the kitchen, boil with an electric kettle or induction hob and run the extractor fan; gas and solid fuels add NO₂ and smoke indoors.';
      return {
        reply: safestWindow.ventilationSafe
          ? `The best time to air out in ${location.name} today is ${windowText(report)} (average AQI ${safestWindow.avgAqi}). Open windows on opposite sides for 10–15 minutes, then close them before evening. ${kitchen}`
          : `Keep windows closed today: even the cleanest hours (${windowText(report)}) average AQI ${safestWindow.avgAqi}. Seal door gaps, wet-mop instead of sweeping, and skip incense and candles. ${kitchen}`,
        keyTakeaways: [
          safestWindow.advisory,
          'Wet-mopping traps dust that a broom would kick back into the air.',
          'Skip incense, scented candles and sprays while the windows are shut.',
        ],
        impactHighlight: personalImpact(
          profile.cookingFuel === 'induction_electric' ? 'smart-ventilation' : 'clean-cooking',
          report,
          profile,
        ),
      };
    },
  },
  {
    keywords: ['mask', 'n95', 'kn95', 'kf94', 'respirator'],
    answer: (report, profile) => ({
      reply: `Use a fitted N95, KN95 or KF94 respirator, not a cloth or surgical mask. It should seal around the nose and under the chin with no gaps when you breathe in. At AQI ${report.current.usAqi}, ${report.current.usAqi > 150 ? 'wear one for any trip outside' : 'wear one if you are sensitive or will be near heavy traffic'}.`,
      keyTakeaways: [
        'Fit matters more than brand: pinch the nose clip and check for leaks.',
        'Child-size KF94 masks exist; adult masks leak on small faces.',
        'Replace a mask when it is damp, dirty or hard to breathe through.',
      ],
      impactHighlight: personalImpact('fitted-masks', report, profile),
    }),
  },
  {
    keywords: ['car', 'drive', 'driving', 'commut*', 'metro', 'bus', 'transit', 'carpool*', 'scooter', 'bike'],
    answer: (report, profile) => {
      const figures = resolveActionFigures('transit-carpool-swap', profile);
      const helps = figures.monthlyCo2SavedKg > 0;
      return {
        reply: helps
          ? `Swapping three of your ${profile.dailyCommuteKm} km trips a week for the metro, bus or a carpool cuts about ${figures.monthlyCo2SavedKg} kg of CO₂ a month, and you spend less time breathing traffic fumes inside the vehicle. When you do drive, set the air to recirculate and switch off the engine at long stops.`
          : `You already travel without adding much exhaust. To cut what you breathe on the way, travel around ${windowText(report)} and use streets a block away from main roads.`,
        keyTakeaways: [
          'Short, cold-start trips in the morning smog pollute the most per km.',
          'Recirculate mode keeps a lot of roadside soot out of the car.',
          'Traffic pollution drops sharply 50–100 m away from a busy road.',
        ],
        impactHighlight: helps
          ? describeCommunityScale(figures, COMMUNITY_SCALE_HOUSEHOLDS)
          : personalImpact('low-exposure-routing', report, profile),
      };
    },
  },
  {
    keywords: ['whatsapp', 'communit*', 'neighbo*', 'rwa', 'alert', 'message', 'group', 'share'],
    answer: (report, profile) => {
      const { location, current } = report;
      return {
        reply: `Here's a message you can send to your building or parents' group:\n\n"${location.name} air today: AQI ${current.usAqi} (${current.label}), PM2.5 ${current.pm25} µg/m³. Cleanest time to be outside: ${windowText(report)}. Let's protect kids and older neighbours: switch engines off when waiting, share school runs, no burning of leaves or rubbish, and give night guards heaters instead of fires."`,
        keyTakeaways: [
          'Stopping idling and open burning gives the fastest local improvement.',
          'Bulk-buying MERV-13 filters and N95 masks as a group cuts the cost.',
        ],
        impactHighlight: describeCommunityScale(
          resolveActionFigures('zero-burn-anti-idling', profile),
          COMMUNITY_SCALE_HOUSEHOLDS,
        ),
      };
    },
  },
];

function generalAnswer(report: AirQualityReport, profile: HouseholdProfile): Answer {
  const { location, current } = report;
  const indoor = profile.hasHepaPurifier
    ? 'run your HEPA purifier in the bedroom overnight and wet-mop the floors'
    : 'set up a DIY box-fan filter in the bedroom';
  return {
    reply: `${location.name} is at AQI ${current.usAqi} (${current.label}), PM2.5 ${current.pm25} µg/m³. For your ${profile.householdSize}-person home, the three most useful steps today are: (1) do outdoor errands around ${windowText(report)}, (2) ${indoor}, and (3) cut local emissions by sharing trips and not burning anything.`,
    keyTakeaways: [
      `Breathing today's outdoor air all day is like smoking about ${current.cigaretteEquivalentPerDay} cigarettes.`,
      `Cleanest two hours: ${windowText(report)}.`,
      'Ask about purifiers, masks, windows, cooking, travel or a message for neighbours.',
    ],
    impactHighlight: personalImpact(profile.hasHepaPurifier ? 'smart-ventilation' : 'diy-box-filter', report, profile),
  };
}

function offTopicAnswer(report: AirQualityReport): Answer {
  return {
    reply:
      'I can only help with air quality: when to go outside, cleaning the air at home, masks, cooking smoke, travel, and getting neighbours involved.',
    keyTakeaways: [
      `${report.location.name} is at AQI ${report.current.usAqi} (${report.current.label}) right now.`,
      `Cleanest time in the next day: ${windowText(report)}.`,
    ],
    impactHighlight: 'Ask a question about the air and I will answer with today’s readings.',
  };
}

export function buildRulesChatResponse(
  report: AirQualityReport,
  profile: HouseholdProfile,
  message: string,
): ChatResponse {
  const text = message.toLowerCase();
  // "car" matches "car" and "cars" but not "care"; "child*" matches "children".
  const mentions = (keyword: string) =>
    keyword.endsWith('*')
      ? new RegExp(`\\b${keyword.slice(0, -1)}`).test(text)
      : new RegExp(`\\b${keyword}(s|es|ing)?\\b`).test(text);
  const answer = detectPromptInjection(message)
    ? offTopicAnswer(report)
    : (TOPICS.find((t) => t.keywords.some(mentions))?.answer(report, profile) ??
      generalAnswer(report, profile));

  return { ...answer, engine: 'rules', modelUsed: RULES_ENGINE_VERSION, safetyDisclaimer: SAFETY_DISCLAIMER };
}

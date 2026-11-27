import { SAFETY_DISCLAIMER } from '../../shared/constants.js';
import type {
  AirQualityReport,
  ChatResponse,
  HouseholdProfile,
} from '../../shared/types.js';
import { detectPromptInjection } from './promptGuard.js';

interface TopicHandler {
  keywords: readonly string[];
  respond: (report: AirQualityReport, profile: HouseholdProfile) => ChatResponse;
}

function makeLocalReply(
  reply: string,
  keyTakeaways: string[],
  impactHighlight: string,
  modelUsed = 'breathesafe-rules-v1',
): ChatResponse {
  return {
    reply,
    engine: 'local-intelligence',
    modelUsed,
    keyTakeaways,
    impactHighlight,
    safetyDisclaimer: SAFETY_DISCLAIMER,
  };
}

function buildGuardrailRefusal(report: AirQualityReport): ChatResponse {
  const { location, current, safestWindow } = report;
  return makeLocalReply(
    'I can only help with urban air quality, winter smog protection, indoor air hacks, and low-emission household or community routines. Ask me about safe outdoor windows, DIY filtration, masks, cooking ventilation, or neighborhood clean-air actions!',
    [
      `Current ${location.name} AQI is ${current.usAqi} (${current.label}).`,
      `Lowest-smog window in the next 24h: ${safestWindow.startLabel}–${safestWindow.endLabel}.`,
    ],
    'Staying focused on evidence-based filtration and emission reductions cuts household PM2.5 exposure by 40–70%.',
    'breathesafe-guardrail-v1',
  );
}

const CHAT_TOPIC_HANDLERS: readonly TopicHandler[] = [
  {
    keywords: ['diy', 'purifier', 'corsi', 'budget'],
    respond: ({ location, current }, profile) =>
      makeLocalReply(
        `For ${location.name}'s current PM2.5 of ${current.pm25} µg/m³, a DIY Corsi-Rosenthal box is the highest-value indoor air hack. Tape four 20×20-inch MERV-13 pleated furnace filters into a cube (arrows pointing inward), seal the bottom with cardboard, and tape a standard 20-inch box fan facing upward on top. Place it in the main bedroom and run it 45 minutes before sleep.`,
        [
          'Total cost is roughly $45–$65 versus $200+ for comparable commercial CADR.',
          'Replace filters every 4–6 months when media turns dark grey.',
          'Pair with silicone door draft strips so outdoor smog cannot leak back in.',
        ],
        `Cuts bedroom PM2.5 by ~48–60%, sparing a family of ${profile.householdSize} roughly 180+ cigarette-equivalents of fine particle exposure over a winter month.`,
      ),
  },
  {
    keywords: ['kid', 'child', 'school', 'play', 'outside', 'walk', 'run'],
    respond: ({ location, current, safestWindow }) =>
      makeLocalReply(
        current.usAqi <= 100
          ? `${location.name} is currently at AQI ${current.usAqi} (${current.label}), which is favorable for outdoor play and walks. Still, try to pick park or residential paths set back at least 50 meters from busy traffic corridors.`
          : `At AQI ${current.usAqi} (${current.label}, PM2.5 ${current.pm25} µg/m³), vigorous outdoor play or jogging in ${location.name} is NOT recommended right now — children breathe ~50% more air per kg of body weight than adults. Move active play indoors near a HEPA or DIY MERV-13 filter. If you must go out for school pickup or errands, aim for ${safestWindow.startLabel}–${safestWindow.endLabel} (avg AQI ${safestWindow.avgAqi}) and use child-sized KF94/KN95 masks.`,
        [
          `Safest outdoor window in next 24h: ${safestWindow.startLabel}–${safestWindow.endLabel} (avg PM2.5 ${safestWindow.avgPm25} µg/m³).`,
          'Avoid 7–10 AM and after-dusk outdoor exercise when winter thermal inversions peak.',
          'Coordinate a 3-family school carpool to eliminate cold-start exhaust at school gates.',
        ],
        'Shifting outdoor time to the afternoon dip + indoor active play reduces child PM2.5 lung load by 35–55% on high-smog days.',
      ),
  },
  {
    keywords: ['window', 'ventilat', 'cook', 'kitchen', 'indoor'],
    respond: ({ location, safestWindow }, profile) =>
      makeLocalReply(
        safestWindow.ventilationSafe
          ? `Today's best ventilation window in ${location.name} is ${safestWindow.startLabel}–${safestWindow.endLabel} (avg AQI ${safestWindow.avgAqi}). Open opposite windows for 10–15 minutes to flush indoor CO₂, then close them before evening inversion sets in. In the kitchen, ${profile.cookingFuel === 'gas' ? 'shift boiling to an electric kettle/induction burner and run your exhaust hood to prevent gas NO₂ buildup' : 'use pan lids and exhaust ventilation during high-heat frying'}.`
          : `Because ${location.name} remains elevated even during its dip (${safestWindow.startLabel}–${safestWindow.endLabel}, avg AQI ${safestWindow.avgAqi}), keep windows closed today and seal door gaps. Prevent indoor pollution spikes by wet-mopping instead of dry sweeping, avoiding incense/candles, and venting kitchen smoke while boiling with electric appliances.`,
        [
          safestWindow.advisory,
          'Wet-mopping traps settled PM10/PM2.5 instead of kicking dust back into breathing height.',
          'Skip incense, scented candles, and aerosol sprays on sealed winter days.',
        ],
        'Combining smart ventilation timing with clean cooking cuts indoor PM2.5 and NO₂ spikes by 30–45%.',
      ),
  },
  {
    keywords: ['whatsapp', 'community', 'neighbor', 'rwa', 'alert', 'message'],
    respond: ({ location, current, safestWindow }) =>
      makeLocalReply(
        `Here is a ready-to-share message for your ${location.name} neighborhood or parent group:\n\n"🌫️ ${location.name} Smog Alert — AQI is ${current.usAqi} (${current.label}), PM2.5: ${current.pm25} µg/m³. Safest errand window today: ${safestWindow.startLabel}–${safestWindow.endLabel}. Let's protect kids & seniors together: (1) Turn off car engines at gates/signals >30s, (2) Share school/office carpools, (3) Keep our block 100% free of leaf/waste burning, and (4) Share electric heaters with night guards. Small habits save lungs!"`,
        [
          'Hyperlocal anti-idling and zero waste-burning deliver immediate neighborhood PM2.5 relief.',
          'Group bulk-buys for MERV-13 filters and N95 masks cut costs by ~35%.',
        ],
        'If 50 families adopt anti-idling + carpooling + zero-burn, your block avoids ~1.9 tons of CO₂ and >1.4 kg of street-level PM2.5 every month.',
      ),
  },
];

function buildGeneralGuidance(report: AirQualityReport, profile: HouseholdProfile): ChatResponse {
  const { location, current, safestWindow } = report;
  const iaqAdvice = profile.hasHepaPurifier
    ? 'run your HEPA purifier in bedrooms overnight and wet-mop floors'
    : 'set up a low-cost DIY Corsi-Rosenthal MERV-13 filter for sleeping rooms';

  return makeLocalReply(
    `In ${location.name}, air quality is currently US AQI ${current.usAqi} (${current.label}, PM2.5 ${current.pm25} µg/m³). For your ${profile.householdSize}-person ${profile.homeType.replace('_', ' ')} household, the top three steps right now are: (1) schedule essential outdoor trips during the ${safestWindow.startLabel}–${safestWindow.endLabel} dispersion dip (avg AQI ${safestWindow.avgAqi}), (2) ${iaqAdvice}, and (3) cut local emissions by carpooling/transit and avoiding idling or open burning.`,
    [
      `Current PM2.5 (${current.pm25} µg/m³) equals ~${current.cigaretteEquivalentPerDay} cigarettes/day of outdoor exposure.`,
      `Best 2-hour window today: ${safestWindow.startLabel}–${safestWindow.endLabel}.`,
      'Pair indoor filtration with clean mobility and electric cooking for both personal and community impact.',
    ],
    'Layering indoor filtration + timed routines + low-emission commuting can cut household PM2.5 inhalation by 50–75% while avoiding 80+ kg CO₂/month.',
  );
}

/**
 * Deterministic context-aware conversational responder used when Gemini is not configured
 * or when prompt-injection guardrails deflect an unsafe input.
 */
export function buildLocalChatResponse(
  report: AirQualityReport,
  profile: HouseholdProfile,
  message: string,
): ChatResponse {
  if (detectPromptInjection(message)) {
    return buildGuardrailRefusal(report);
  }

  const lower = message.toLowerCase();
  const matched = CHAT_TOPIC_HANDLERS.find((handler) =>
    handler.keywords.some((keyword) => lower.includes(keyword)),
  );
  return matched ? matched.respond(report, profile) : buildGeneralGuidance(report, profile);
}

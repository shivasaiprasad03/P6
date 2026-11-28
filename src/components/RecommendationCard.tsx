import type { ActionFigures, ActionRecommendation, RecommendationCategory } from '../../shared/types.js';

export const CATEGORY_META: Record<RecommendationCategory, { label: string }> = {
  low_emission_routine: { label: 'Routine' },
  indoor_air_hack: { label: 'Indoor air' },
  sustainable_alternative: { label: 'Cleaner swap' },
  community_action: { label: 'Community' },
};

const EFFORT_LABELS = {
  quick_win: 'Quick win',
  daily_habit: 'Daily habit',
  lifestyle_shift: 'Bigger change',
} as const;

/** Short figure labels, e.g. "−45% your PM2.5 dose", "+8 kg CO₂ a month". */
export function figureLabels(figures: ActionFigures): string[] {
  const labels: string[] = [];
  if (figures.exposureReductionPct > 0) labels.push(`−${figures.exposureReductionPct}% your PM2.5 dose`);
  if (figures.monthlyCo2SavedKg > 0) labels.push(`−${figures.monthlyCo2SavedKg} kg CO₂ a month`);
  if (figures.monthlyCo2SavedKg < 0) labels.push(`+${-figures.monthlyCo2SavedKg} kg CO₂ a month`);
  if (figures.monthlyPm25AvoidedGrams > 0) labels.push(`−${figures.monthlyPm25AvoidedGrams} g PM2.5 emitted a month`);
  return labels.length > 0 ? labels : ['No measurable change for your household'];
}

/**
 * One recommendation: what to do and when, the steps, and the estimated effect on your
 * own exposure and on local emissions. Figures come from the shared action catalog.
 */
export function RecommendationCard({ recommendation }: { recommendation: ActionRecommendation }) {
  const { category, effort, estimatedCost, figures } = recommendation;

  return (
    <article className="rec">
      <p className="rec-meta">
        <span className="rec-category">{CATEGORY_META[category].label}</span>
        <span>{EFFORT_LABELS[effort]}</span>
        <span>{estimatedCost}</span>
      </p>

      <h3 className="rec-title">{recommendation.title}</h3>
      <p className="rec-summary">{recommendation.summary}</p>
      <p className="rec-when">
        <strong>When:</strong> {recommendation.bestTimeWindow}
      </p>

      <ol className="rec-steps">
        {recommendation.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="rec-impact" role="group" aria-label={`Estimated effect of: ${recommendation.title}`}>
        <ul className="rec-figures">
          {figureLabels(figures).map((label) => (
            <li key={label}>
              <span className="figure">{label}</span>
            </li>
          ))}
        </ul>
        <p>
          <strong>For you:</strong> {recommendation.personalImpact}
        </p>
        <p>
          <strong>For your area:</strong> {recommendation.communityImpact}
        </p>
      </div>
    </article>
  );
}

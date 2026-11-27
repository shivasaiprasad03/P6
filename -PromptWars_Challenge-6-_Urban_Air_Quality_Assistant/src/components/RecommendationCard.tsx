import type { ActionRecommendation, RecommendationCategory } from '../../shared/types.js';

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

interface RecommendationCardProps {
  recommendation: ActionRecommendation;
}

/**
 * One recommendation: what to do and when, the steps, and the estimated effect
 * on your own exposure and on local emissions.
 */
export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const meta = CATEGORY_META[recommendation.category];
  const { impact } = recommendation;

  return (
    <article className="rec">
      <p className="rec-meta">
        <span className="rec-category">{meta.label}</span>
        <span>{EFFORT_LABELS[recommendation.effort]}</span>
        <span>{recommendation.estimatedCost}</span>
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

      <div className="rec-impact" aria-label={`Estimated effect of ${recommendation.title}`}>
        <ul className="rec-figures">
          <li>
            <span className="figure">−{impact.pm25ExposureReductionPct}%</span> PM2.5 exposure
          </li>
          {impact.weeklyCo2SavedKg > 0 && (
            <li>
              <span className="figure">−{impact.weeklyCo2SavedKg} kg</span> CO₂ a week
            </li>
          )}
          {impact.weeklyPm25AvoidedGrams > 0 && (
            <li>
              <span className="figure">−{impact.weeklyPm25AvoidedGrams} g</span> PM2.5 a week
            </li>
          )}
        </ul>
        <p>
          <strong>For you:</strong> {impact.personalHealthExplanation}
        </p>
        <p>
          <strong>For your area:</strong> {impact.communityScaleExplanation}
        </p>
      </div>
    </article>
  );
}

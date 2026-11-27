import { useState } from 'react';
import { AlertCircle, Calculator, Check, Copy, Printer } from 'lucide-react';
import type { ActionPlanResponse, RecommendationCategory } from '../../shared/types.js';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.js';
import { CATEGORY_META, RecommendationCard } from './RecommendationCard.js';

interface ActionPlanViewProps {
  plan: ActionPlanResponse | null;
  loading: boolean;
  /** Opens the impact calculator preloaded with this plan's actions. */
  onOpenCalculator: () => void;
}

function engineNote(plan: ActionPlanResponse): string {
  const freshness = plan.cached ? ' (reused from a few minutes ago)' : '';
  return plan.engine === 'gemini'
    ? `Written by Google Gemini (${plan.modelUsed})${freshness}. Impact figures come from BreatheSafe's action catalog, not the model.`
    : `Prepared by BreatheSafe's rule-based advisor${freshness}.`;
}

/**
 * Today's plan: a short briefing, urgent alerts, recommendations filterable by category,
 * and a ready-to-send message for neighbours or a school group.
 */
export function ActionPlanView({ plan, loading, onOpenCalculator }: ActionPlanViewProps) {
  const [filter, setFilter] = useState<'all' | RecommendationCategory>('all');
  const { copied, copy } = useCopyToClipboard();

  if (loading && !plan) {
    return (
      <section className="panel panel-loading" aria-busy="true" aria-live="polite">
        <h2 className="panel-title">Preparing today&apos;s plan…</h2>
        <p className="muted">Matching current readings to your household.</p>
      </section>
    );
  }

  if (!plan) {
    return null;
  }

  const filteredRecs =
    filter === 'all'
      ? plan.recommendations
      : plan.recommendations.filter((item) => item.category === filter);

  return (
    <section className="panel plan" aria-labelledby="action-plan-heading" aria-busy={loading}>
      <p className="sr-only" role="status" aria-live="polite">
        {loading
          ? 'Updating plan…'
          : `${plan.headline}. Showing ${filteredRecs.length} recommendations.`}
      </p>

      <div className="panel-head">
        <div>
          <p className="eyebrow">Today&apos;s plan</p>
          <h2 id="action-plan-heading" className="plan-headline">
            {plan.headline}
          </h2>
          <p className="muted small">{engineNote(plan)}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm no-print"
          onClick={() => window.print()}
          aria-label="Print this plan"
        >
          <Printer size={14} aria-hidden="true" />
          Print
        </button>
      </div>

      <p className="plan-lead">{plan.briefing}</p>

      {plan.alerts.length > 0 && (
        <div className="notice notice-alert" role="alert">
          <p className="notice-title">
            <AlertCircle size={16} aria-hidden="true" />
            Take care today
          </p>
          <ul>
            {plan.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="filter-row no-print" role="group" aria-label="Filter by category">
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All ({plan.recommendations.length})
        </button>
        {(Object.keys(CATEGORY_META) as RecommendationCategory[]).map((cat) => {
          const count = plan.recommendations.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className="chip"
              aria-pressed={filter === cat}
              onClick={() => setFilter(cat)}
            >
              {CATEGORY_META[cat].label} ({count})
            </button>
          );
        })}
      </div>

      <div className="rec-list">
        {filteredRecs.map((rec) => (
          <RecommendationCard key={rec.actionId} recommendation={rec} />
        ))}
      </div>

      <button type="button" className="btn no-print" onClick={onOpenCalculator}>
        <Calculator size={15} aria-hidden="true" />
        Add up these actions in the impact calculator
      </button>

      <div className="share-box">
        <div className="panel-head">
          <h3 className="panel-label">Message for your neighbours or school group</h3>
          <button
            type="button"
            className="btn btn-sm no-print"
            onClick={() => {
              void copy(plan.communityMessage);
            }}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy message'}
          </button>
        </div>
        <pre className="share-text">{plan.communityMessage}</pre>
      </div>

      <p className="fineprint">{plan.safetyDisclaimer}</p>
    </section>
  );
}

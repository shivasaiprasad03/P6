import { useMemo, useState } from 'react';
import { ACTION_LIST, resolveActionFigures, type ActionId } from '../../shared/actions.js';
import { simulateImpact } from '../../shared/impact.js';
import type { HouseholdProfile } from '../../shared/types.js';
import { ActionChoiceCard } from './ActionChoiceCard.js';

interface ImpactSimulatorProps {
  baselinePm25: number;
  profile: HouseholdProfile;
  cityName: string;
  /** Actions ticked when the calculator opens, normally those in today's plan. */
  initialSelectedIds: readonly ActionId[];
}

function formatUsd(monthlySavings: number): string {
  if (monthlySavings === 0) return 'about the same cost as now';
  return monthlySavings > 0
    ? `saves about $${monthlySavings} a month`
    : `costs about $${Math.abs(monthlySavings)} a month`;
}

/**
 * Shows the combined effect of chosen habits on the household's PM2.5 dose, and the
 * CO₂ and PM2.5 avoided when 1 to 1,000 households do the same. Runs entirely in the
 * browser using the same catalog as the plan, so the numbers update instantly.
 */
export function ImpactSimulator({ baselinePm25, profile, cityName, initialSelectedIds }: ImpactSimulatorProps) {
  const [selectedIds, setSelectedIds] = useState<ActionId[]>(() => [...initialSelectedIds]);
  const [communityHouseholds, setCommunityHouseholds] = useState(100);

  const result = useMemo(
    () => simulateImpact({ selectedActionIds: selectedIds, baselinePm25, profile, communityHouseholds }),
    [selectedIds, baselinePm25, profile, communityHouseholds],
  );

  function toggleAction(id: ActionId): void {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const people = `${profile.householdSize} ${profile.householdSize === 1 ? 'person' : 'people'}`;

  return (
    <section className="stack-md" aria-labelledby="simulator-heading">
      <div className="page-intro">
        <p className="eyebrow">Impact calculator</p>
        <h2 id="simulator-heading" className="page-title">
          What changes if you act?
        </h2>
        <p className="muted">
          Tick the habits you would take on. The figures estimate how much less polluted air your
          household breathes, and what happens if neighbours join in. They use today&apos;s PM2.5 in{' '}
          {cityName} ({baselinePm25} µg/m³) and your household details.
        </p>
      </div>

      <div className="panel">
        <label htmlFor="community-scale-slider" className="label">
          Households taking part: <strong className="figure">{communityHouseholds.toLocaleString()}</strong>
        </label>
        <input
          id="community-scale-slider"
          type="range"
          className="range"
          min={1}
          max={1000}
          step={1}
          value={communityHouseholds}
          onChange={(e) => setCommunityHouseholds(Number(e.target.value))}
        />
        <div className="range-ticks" aria-hidden="true">
          <span>1</span>
          <span>250</span>
          <span>500</span>
          <span>750</span>
          <span>1,000</span>
        </div>
      </div>

      <div className="stat-grid" aria-live="polite">
        <div className="panel stat">
          <p className="stat-label">Your household&apos;s PM2.5 dose</p>
          <p className="stat-value">−{result.combinedExposureReductionPct}%</p>
          <p className="muted small">
            Like your indoor air going from about {result.indoorPm25Before} to{' '}
            <strong>{result.indoorPm25After} µg/m³</strong>: roughly {result.avoidedCigarettesPerMonth}{' '}
            fewer cigarette-equivalents a month across {people}.
          </p>
        </div>

        <div className="panel stat">
          <p className="stat-label">CO₂ avoided each month</p>
          <p className="stat-value">{result.communityMonthlyCo2SavedKg.toLocaleString()} kg</p>
          <p className="muted small">
            Plus <strong>{result.communityMonthlyPm25AvoidedKg} kg</strong> of PM2.5 not emitted locally.
            Your household alone: {result.householdMonthlyCo2SavedKg} kg CO₂.
          </p>
        </div>

        <div className="panel stat">
          <p className="stat-label">Same CO₂ as</p>
          <p className="stat-value">{result.equivalentTrees.toLocaleString()} trees</p>
          <p className="muted small">
            absorb in a month. For your budget, this <strong>{formatUsd(result.monthlySavingsUsd)}</strong>.
          </p>
        </div>
      </div>

      <h3 className="section-title">
        Habits and swaps <span className="muted">({selectedIds.length} selected)</span>
      </h3>

      <div className="pledge-grid">
        {ACTION_LIST.map((action) => (
          <ActionChoiceCard
            key={action.id}
            action={action}
            figures={resolveActionFigures(action.id, profile)}
            checked={selectedIds.includes(action.id)}
            onToggle={toggleAction}
          />
        ))}
      </div>

      <p className="fineprint">
        Estimates, not measurements. Each action&apos;s figures and how they combine are explained in
        the project README.
      </p>
    </section>
  );
}

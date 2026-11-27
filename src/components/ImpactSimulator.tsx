import { useEffect, useState } from 'react';
import { PLEDGE_ACTIONS } from '../../shared/constants.js';
import type { ImpactSimulationResult } from '../../shared/types.js';
import { simulateImpactApi } from '../lib/apiClient.js';
import { PledgeActionCard } from './PledgeActionCard.js';

interface ImpactSimulatorProps {
  baselinePm25: number;
  householdSize: number;
  cityName: string;
}

const DEFAULT_SELECTED = [
  'corsi-rosenthal-diy',
  'smart-ventilation-window',
  'transit-carpool-swap',
  'zero-burn-anti-idling',
];

/**
 * Estimates the drop in household PM2.5 exposure from selected habits, and the CO₂/PM2.5
 * avoided when 1 to 1,000 households adopt them.
 */
export function ImpactSimulator({ baselinePm25, householdSize, cityName }: ImpactSimulatorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED);
  const [communityHouseholds, setCommunityHouseholds] = useState(100);
  const [result, setResult] = useState<ImpactSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setError(null);
        const sim = await simulateImpactApi({
          selectedActionIds: selectedIds,
          baselinePm25: Math.max(1, baselinePm25),
          householdSize,
          communityHouseholds,
        });
        if (active) setResult(sim);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to run the calculation');
        }
      }
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedIds, baselinePm25, householdSize, communityHouseholds]);

  function toggleAction(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  return (
    <section className="stack-md" aria-labelledby="simulator-heading">
      <div className="page-intro">
        <p className="eyebrow">Impact calculator</p>
        <h2 id="simulator-heading" className="page-title">
          What changes if you act?
        </h2>
        <p className="muted">
          Pick the habits you&apos;d take on. The figures estimate how much less polluted air your
          household breathes, and what happens if neighbours join in. Based on today&apos;s PM2.5
          in {cityName}: {baselinePm25} µg/m³.
        </p>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <div className="panel">
        <label htmlFor="community-scale-slider" className="label">
          Households taking part:{' '}
          <strong className="figure">{communityHouseholds.toLocaleString()}</strong>
        </label>
        <input
          id="community-scale-slider"
          type="range"
          className="range"
          min={1}
          max={1000}
          step={10}
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

      {result && (
        <div className="stat-grid" aria-live="polite">
          <div className="panel stat">
            <p className="stat-label">Household PM2.5 cut</p>
            <p className="stat-value">−{result.combinedPm25ExposureReductionPct}%</p>
            <p className="muted small">
              Indoor PM2.5 falls to about <strong>{result.estimatedIndoorPm25After} µg/m³</strong>,
              roughly {result.avoidedCigarettesPerMonth} fewer cigarette-equivalents a month across{' '}
              {householdSize} {householdSize === 1 ? 'person' : 'people'}.
            </p>
          </div>

          <div className="panel stat">
            <p className="stat-label">CO₂ avoided each month</p>
            <p className="stat-value">{result.communityMonthlyCo2SavedKg.toLocaleString()} kg</p>
            <p className="muted small">
              Plus <strong>{result.communityMonthlyPm25AvoidedKg} kg</strong> of local PM2.5 not
              emitted. Per household: {result.householdMonthlyCo2SavedKg} kg CO₂.
            </p>
          </div>

          <div className="panel stat">
            <p className="stat-label">Same CO₂ as</p>
            <p className="stat-value">{result.equivalentTreesPlanted.toLocaleString()} trees</p>
            <p className="muted small">
              absorb in a month. Household budget:{' '}
              <strong>
                {result.estimatedMonthlySavingsUsd >= 0
                  ? `saves about $${result.estimatedMonthlySavingsUsd}/month`
                  : `costs about $${Math.abs(result.estimatedMonthlySavingsUsd)}/month`}
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      <h3 className="section-title">
        Habits and swaps <span className="muted">({selectedIds.length} selected)</span>
      </h3>

      <div className="pledge-grid">
        {PLEDGE_ACTIONS.map((action) => (
          <PledgeActionCard
            key={action.id}
            action={action}
            checked={selectedIds.includes(action.id)}
            onToggle={toggleAction}
          />
        ))}
      </div>
    </section>
  );
}

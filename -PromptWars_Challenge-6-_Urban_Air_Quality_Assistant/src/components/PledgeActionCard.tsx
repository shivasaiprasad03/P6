import type { PledgeActionItem } from '../../shared/types.js';

interface PledgeActionCardProps {
  action: PledgeActionItem;
  checked: boolean;
  onToggle: (id: string) => void;
}

/** A selectable habit or swap in the impact calculator. */
export function PledgeActionCard({ action, checked, onToggle }: PledgeActionCardProps) {
  const checkboxId = `pledge-${action.id}`;

  return (
    <div className="pledge" data-selected={checked}>
      <input
        id={checkboxId}
        type="checkbox"
        className="pledge-check"
        checked={checked}
        onChange={() => onToggle(action.id)}
      />
      <div>
        <label htmlFor={checkboxId} className="pledge-title">
          {action.title}
        </label>
        <p className="pledge-desc">{action.description}</p>
        <p className="rec-meta">
          <span className="rec-category">−{action.pm25ExposureReductionPct}% exposure</span>
          {action.monthlyCo2SavedKg > 0 && <span>−{action.monthlyCo2SavedKg} kg CO₂/mo</span>}
          <span>−{action.monthlyPm25AvoidedGrams} g PM2.5/mo</span>
        </p>
        <p className="pledge-why">{action.whyItWorks}</p>
      </div>
    </div>
  );
}

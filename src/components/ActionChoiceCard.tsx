import type { ActionDefinition, ActionFigures } from '../../shared/types.js';
import { figureLabels } from './RecommendationCard.js';

interface ActionChoiceCardProps {
  action: ActionDefinition;
  /** The action's figures tailored to this household. */
  figures: ActionFigures;
  checked: boolean;
  onToggle: (id: ActionDefinition['id']) => void;
}

/** A selectable habit or swap in the impact calculator. */
export function ActionChoiceCard({ action, figures, checked, onToggle }: ActionChoiceCardProps) {
  const checkboxId = `action-${action.id}`;

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
          {figureLabels(figures).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </p>
        <p className="pledge-why">{action.whyItWorks}</p>
      </div>
    </div>
  );
}

import type {
  BudgetTier,
  CommuteMode,
  CommunityRole,
  CookingFuel,
  HomeType,
  HouseholdProfile,
  VulnerableGroup,
} from '../../shared/types.js';

interface HouseholdProfileFormProps {
  profile: HouseholdProfile;
  focusNote: string;
  generating: boolean;
  onChangeProfile: (next: HouseholdProfile) => void;
  onChangeFocusNote: (note: string) => void;
  onGeneratePlan: () => void;
}

type Option<T extends string> = { value: T; label: string };

const VULNERABLE_OPTIONS: ReadonlyArray<Option<VulnerableGroup>> = [
  { value: 'infants', label: 'Baby (0–2)' },
  { value: 'children', label: 'Children' },
  { value: 'elderly', label: 'Over 65' },
  { value: 'asthma', label: 'Asthma / COPD' },
  { value: 'pregnant', label: 'Pregnancy' },
  { value: 'outdoor_workers', label: 'Works outdoors' },
];

const COMMUNITY_ROLE_OPTIONS: ReadonlyArray<Option<CommunityRole>> = [
  { value: 'family', label: 'My household' },
  { value: 'school_pta', label: "A school or parents' group" },
  { value: 'neighborhood_rwa', label: "A residents' association" },
];

const HOME_TYPE_OPTIONS: ReadonlyArray<Option<HomeType>> = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'independent_house', label: 'House' },
  { value: 'shared_housing', label: 'Shared or multi-family home' },
];

const COOKING_FUEL_OPTIONS: ReadonlyArray<Option<CookingFuel>> = [
  { value: 'gas', label: 'Gas (LPG / piped)' },
  { value: 'induction_electric', label: 'Induction or electric' },
  { value: 'biomass_solid', label: 'Wood, coal or other solid fuel' },
];

const COMMUTE_MODE_OPTIONS: ReadonlyArray<Option<CommuteMode>> = [
  { value: 'car_petrol_diesel', label: 'Petrol or diesel car' },
  { value: 'two_wheeler', label: 'Motorbike or scooter' },
  { value: 'car_ev_hybrid', label: 'Electric or hybrid car' },
  { value: 'public_transit', label: 'Metro or bus' },
  { value: 'walk_cycle', label: 'Walking or cycling' },
  { value: 'remote', label: 'Mostly at home' },
];

const BUDGET_TIER_OPTIONS: ReadonlyArray<Option<BudgetTier>> = [
  { value: 'low_cost', label: 'Low cost / DIY' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'flexible', label: 'Flexible' },
];

/** Keeps a numeric field inside its allowed range; an empty or invalid entry becomes `min`. */
export function clampNumber(raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => {
          // Only accept values from our own option list, never arbitrary DOM input.
          const match = options.find((opt) => opt.value === e.target.value);
          if (match) onChange(match.value);
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clampNumber(e.target.value, min, max))}
      />
    </div>
  );
}

/**
 * Household details used to tailor the plan: who lives there, the home, cooking,
 * commuting, budget, and an optional note about the day.
 */
export function HouseholdProfileForm({
  profile,
  focusNote,
  generating,
  onChangeProfile,
  onChangeFocusNote,
  onGeneratePlan,
}: HouseholdProfileFormProps) {
  function update<K extends keyof HouseholdProfile>(key: K, value: HouseholdProfile[K]): void {
    onChangeProfile({ ...profile, [key]: value });
  }

  function toggleVulnerableGroup(group: VulnerableGroup): void {
    const exists = profile.vulnerableGroups.includes(group);
    update(
      'vulnerableGroups',
      exists ? profile.vulnerableGroups.filter((g) => g !== group) : [...profile.vulnerableGroups, group],
    );
  }

  return (
    <section className="panel profile" aria-labelledby="profile-heading">
      <p className="eyebrow">Your household</p>
      <h2 id="profile-heading" className="panel-title">
        About your home
      </h2>
      <p className="muted">The plan adjusts to these answers.</p>

      <form
        className="profile-form"
        aria-busy={generating}
        onSubmit={(e) => {
          e.preventDefault();
          if (!generating) onGeneratePlan();
        }}
      >
        <div className="fields">
          <NumberField
            id="household-size"
            label="Household size"
            value={profile.householdSize}
            min={1}
            max={20}
            onChange={(n) => update('householdSize', Math.round(n))}
          />
          <SelectField
            id="community-role"
            label="Who are you planning for?"
            value={profile.communityRole}
            options={COMMUNITY_ROLE_OPTIONS}
            onChange={(v) => update('communityRole', v)}
          />
          <SelectField
            id="home-type"
            label="Home type"
            value={profile.homeType}
            options={HOME_TYPE_OPTIONS}
            onChange={(v) => update('homeType', v)}
          />
          <SelectField
            id="cooking-fuel"
            label="Cooking fuel"
            value={profile.cookingFuel}
            options={COOKING_FUEL_OPTIONS}
            onChange={(v) => update('cookingFuel', v)}
          />
          <SelectField
            id="commute-mode"
            label="Main way of getting around"
            value={profile.commuteMode}
            options={COMMUTE_MODE_OPTIONS}
            onChange={(v) => update('commuteMode', v)}
          />
          <NumberField
            id="commute-km"
            label="Daily round trip (km)"
            value={profile.dailyCommuteKm}
            min={0}
            max={250}
            onChange={(n) => update('dailyCommuteKm', n)}
          />
          <SelectField
            id="budget-tier"
            label="Budget"
            value={profile.budgetTier}
            options={BUDGET_TIER_OPTIONS}
            onChange={(v) => update('budgetTier', v)}
          />

          <div className="field field-wide">
            <label className="check">
              <input
                type="checkbox"
                checked={profile.hasHepaPurifier}
                onChange={(e) => update('hasHepaPurifier', e.target.checked)}
              />
              We already own a HEPA purifier
            </label>
          </div>
        </div>

        <fieldset className="field field-wide fieldset">
          <legend className="label">Anyone more sensitive to pollution?</legend>
          <div className="check-grid">
            {VULNERABLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="check">
                <input
                  type="checkbox"
                  checked={profile.vulnerableGroups.includes(opt.value)}
                  onChange={() => toggleVulnerableGroup(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="focus-note" className="label">
            Anything specific today? <span className="label-hint">(optional)</span>
          </label>
          <input
            id="focus-note"
            type="text"
            className="input"
            maxLength={240}
            value={focusNote}
            onChange={(e) => onChangeFocusNote(e.target.value)}
            placeholder="e.g. football practice at 4 pm"
            aria-describedby="focus-note-hint"
          />
          <p id="focus-note-hint" className="hint">
            Mention a time and the plan checks it against the forecast. Up to 240 characters.
          </p>
        </div>

        {/* aria-disabled, not disabled, so the button keeps keyboard focus while the plan updates. */}
        <button type="submit" className="btn btn-primary btn-block" aria-disabled={generating}>
          {generating ? 'Updating plan…' : 'Update my plan'}
        </button>
      </form>
    </section>
  );
}

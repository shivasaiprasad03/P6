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

const VULNERABLE_OPTIONS: ReadonlyArray<{ value: VulnerableGroup; label: string }> = [
  { value: 'infants', label: 'Baby (0–2)' },
  { value: 'children', label: 'Children' },
  { value: 'elderly', label: 'Over 65' },
  { value: 'asthma', label: 'Asthma / COPD' },
  { value: 'pregnant', label: 'Pregnancy' },
  { value: 'outdoor_workers', label: 'Works outdoors' },
];

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
  function toggleVulnerableGroup(group: VulnerableGroup): void {
    const exists = profile.vulnerableGroups.includes(group);
    const nextGroups = exists
      ? profile.vulnerableGroups.filter((g) => g !== group)
      : [...profile.vulnerableGroups, group];
    onChangeProfile({ ...profile, vulnerableGroups: nextGroups });
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
        onSubmit={(e) => {
          e.preventDefault();
          onGeneratePlan();
        }}
      >
        <div className="fields">
          <div className="field">
            <label htmlFor="household-size" className="label">
              Household size
            </label>
            <input
              id="household-size"
              type="number"
              className="input"
              min={1}
              max={20}
              value={profile.householdSize}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  householdSize: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="community-role" className="label">
              Who are you planning for?
            </label>
            <select
              id="community-role"
              className="select"
              value={profile.communityRole}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  communityRole: e.target.value as CommunityRole,
                })
              }
            >
              <option value="family">My household</option>
              <option value="school_pta">A school or parents' group</option>
              <option value="neighborhood_rwa">A residents' association</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="home-type" className="label">
              Home type
            </label>
            <select
              id="home-type"
              className="select"
              value={profile.homeType}
              onChange={(e) =>
                onChangeProfile({ ...profile, homeType: e.target.value as HomeType })
              }
            >
              <option value="apartment">Apartment</option>
              <option value="independent_house">House</option>
              <option value="shared_housing">Shared or multi-family home</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="cooking-fuel" className="label">
              Cooking fuel
            </label>
            <select
              id="cooking-fuel"
              className="select"
              value={profile.cookingFuel}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  cookingFuel: e.target.value as CookingFuel,
                })
              }
            >
              <option value="gas">Gas (LPG / piped)</option>
              <option value="induction_electric">Induction or electric</option>
              <option value="biomass_solid">Wood, coal or other solid fuel</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="commute-mode" className="label">
              Main way of getting around
            </label>
            <select
              id="commute-mode"
              className="select"
              value={profile.commuteMode}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  commuteMode: e.target.value as CommuteMode,
                })
              }
            >
              <option value="car_petrol_diesel">Petrol or diesel car</option>
              <option value="two_wheeler">Motorbike or scooter</option>
              <option value="car_ev_hybrid">Electric or hybrid car</option>
              <option value="public_transit">Metro or bus</option>
              <option value="walk_cycle">Walking or cycling</option>
              <option value="remote">Mostly at home</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="commute-km" className="label">
              Daily round trip (km)
            </label>
            <input
              id="commute-km"
              type="number"
              className="input"
              min={0}
              max={250}
              value={profile.dailyCommuteKm}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  dailyCommuteKm: Math.max(0, Math.min(250, Number(e.target.value) || 0)),
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="budget-tier" className="label">
              Budget
            </label>
            <select
              id="budget-tier"
              className="select"
              value={profile.budgetTier}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  budgetTier: e.target.value as BudgetTier,
                })
              }
            >
              <option value="low_cost">Low cost / DIY</option>
              <option value="moderate">Moderate</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          <div className="field field-wide">
            <label className="check">
              <input
                type="checkbox"
                checked={profile.hasHepaPurifier}
                onChange={(e) =>
                  onChangeProfile({ ...profile, hasHepaPurifier: e.target.checked })
                }
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
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={generating}>
          {generating ? 'Updating plan…' : 'Update my plan'}
        </button>
      </form>
    </section>
  );
}

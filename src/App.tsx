import { useState } from 'react';
import type { ActionId } from '../shared/actions.js';
import { ActionPlanView } from './components/ActionPlanView.js';
import { AdvisorChat } from './components/AdvisorChat.js';
import { AirQualityOverview } from './components/AirQualityOverview.js';
import { AppHeader, type ActiveTab } from './components/AppHeader.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { HouseholdProfileForm } from './components/HouseholdProfileForm.js';
import { ImpactSimulator } from './components/ImpactSimulator.js';
import { LocationSelector } from './components/LocationSelector.js';
import { useAirQualityDashboard } from './hooks/useAirQualityDashboard.js';
import { useThemePreferences } from './hooks/useThemePreferences.js';

/** Calculator selection before any plan has loaded. */
const DEFAULT_CALCULATOR_ACTIONS: readonly ActionId[] = [
  'diy-box-filter',
  'smart-ventilation',
  'transit-carpool-swap',
  'zero-burn-anti-idling',
];

/**
 * Application shell: masthead with section tabs, the city picker, and the three sections
 * (today's readings and plan, the impact calculator, and the question box).
 */
export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const { theme, highContrast, toggleTheme, toggleHighContrast } = useThemePreferences();
  const dashboard = useAirQualityDashboard();

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AppHeader
        activeTab={activeTab}
        theme={theme}
        highContrast={highContrast}
        onSelectTab={setActiveTab}
        onToggleTheme={toggleTheme}
        onToggleHighContrast={toggleHighContrast}
      />

      <main id="main-content" className="main page-width" tabIndex={-1}>
        <LocationSelector
          selectedCity={dashboard.selectedCity}
          onSelectCity={dashboard.selectCity}
          onLocateMe={dashboard.locateMe}
        />

        {dashboard.errorMessage && (
          <div className="notice notice-error" role="alert">
            {dashboard.errorMessage}
          </div>
        )}

        <ErrorBoundary>
          {activeTab === 'dashboard' && (
            <div
              id="panel-dashboard"
              role="tabpanel"
              aria-labelledby="tab-dashboard"
              className="stack-lg"
            >
              <AirQualityOverview
                report={dashboard.report}
                loading={dashboard.loadingAqi}
                liveEnabled={dashboard.liveEnabled}
                lastSyncedAt={dashboard.lastSyncedAt}
                isFavorite={dashboard.isFavorite}
                onToggleLive={dashboard.toggleLive}
                onRefresh={dashboard.refreshAqi}
                onToggleFavorite={dashboard.toggleFavorite}
              />

              <div className="plan-layout">
                <ActionPlanView
                  plan={dashboard.plan}
                  loading={dashboard.loadingPlan}
                  onOpenCalculator={() => setActiveTab('simulator')}
                />
                <HouseholdProfileForm
                  profile={dashboard.profile}
                  focusNote={dashboard.focusNote}
                  generating={dashboard.loadingPlan}
                  onChangeProfile={dashboard.setProfile}
                  onChangeFocusNote={dashboard.setFocusNote}
                  onGeneratePlan={dashboard.regeneratePlan}
                />
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div id="panel-simulator" role="tabpanel" aria-labelledby="tab-simulator">
              <ImpactSimulator
                baselinePm25={dashboard.report?.current.pm25 ?? 0}
                profile={dashboard.profile}
                cityName={dashboard.selectedCity.name}
                initialSelectedIds={
                  dashboard.plan?.recommendations.map((r) => r.actionId) ?? DEFAULT_CALCULATOR_ACTIONS
                }
              />
            </div>
          )}

          {activeTab === 'chat' && (
            <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat">
              <AdvisorChat
                key={`${dashboard.selectedCity.latitude},${dashboard.selectedCity.longitude}`}
                location={dashboard.selectedCity}
                profile={dashboard.profile}
                currentAqi={dashboard.report?.current.usAqi}
              />
            </div>
          )}
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <div className="footer-inner page-width">
          <p>
            <strong>BreatheSafe</strong> · Readings and forecasts from{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{' '}
            (CAMS air quality model). AQI follows the US EPA scale.
          </p>
          <p>General guidance only, not medical advice.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

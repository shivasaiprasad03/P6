import { useRef, type KeyboardEvent } from 'react';
import { Contrast, Moon, Sun } from 'lucide-react';
import type { ColorTheme } from '../hooks/useThemePreferences.js';

export type ActiveTab = 'dashboard' | 'simulator' | 'chat';

export const WORKSPACE_TABS: ReadonlyArray<{
  id: ActiveTab;
  label: string;
  panelId: string;
}> = [
  { id: 'dashboard', label: 'Today', panelId: 'panel-dashboard' },
  { id: 'simulator', label: 'Impact calculator', panelId: 'panel-simulator' },
  { id: 'chat', label: 'Ask a question', panelId: 'panel-chat' },
];

interface AppHeaderProps {
  activeTab: ActiveTab;
  theme: ColorTheme;
  highContrast: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleTheme: () => void;
  onToggleHighContrast: () => void;
}

/** Logo mark: three wind strokes in a rounded square. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="brand-mark" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" className="brand-mark-bg" />
      <path
        d="M7 13h12a3.5 3.5 0 1 0-3.5-3.5M7 18h16a3.5 3.5 0 1 1-3.5 3.5M7 23h7"
        className="brand-mark-wind"
      />
    </svg>
  );
}

/**
 * Masthead with the wordmark, display controls, and the section tabs
 * (WAI-ARIA tablist with roving tabindex and arrow/Home/End keys).
 */
export function AppHeader({
  activeTab,
  theme,
  highContrast,
  onSelectTab,
  onToggleTheme,
  onToggleHighContrast,
}: AppHeaderProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void {
    const count = WORKSPACE_TABS.length;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % count;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + count) % count;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = count - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const targetTab = WORKSPACE_TABS[nextIndex];
    if (targetTab) {
      onSelectTab(targetTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <header className="masthead">
      <div className="masthead-row page-width">
        <div className="brand">
          <BrandMark />
          <div>
            <h1 className="brand-name">BreatheSafe</h1>
            <p className="brand-tagline">Air quality, hour by hour</p>
          </div>
        </div>

        <div className="masthead-tools">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-pressed={highContrast}
            onClick={onToggleHighContrast}
          >
            <Contrast size={15} aria-hidden="true" />
            <span className="hide-narrow">High contrast</span>
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={onToggleTheme}
          >
            {theme === 'light' ? (
              <Moon size={15} aria-hidden="true" />
            ) : (
              <Sun size={15} aria-hidden="true" />
            )}
            <span className="hide-narrow">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>

      <nav className="tabs-bar" aria-label="Sections">
        <div className="tabs page-width" role="tablist" aria-label="BreatheSafe sections">
          {WORKSPACE_TABS.map((tab, index) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={tab.panelId}
                className="tab"
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

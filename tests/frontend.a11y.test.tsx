// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOUSEHOLD_PROFILE, PRESET_CITIES } from '../shared/constants.js';
import { buildRulesChatResponse } from '../shared/advisor/chatEngine.js';
import { buildRulesPlan } from '../shared/advisor/planEngine.js';
import { buildSampleReport } from '../shared/airQuality/sampleReport.js';
import { App } from '../src/App.js';
import { ErrorBoundary } from '../src/components/ErrorBoundary.js';

function ThrowingWidget({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Simulated widget failure');
  }
  return <p>Healthy widget content</p>;
}

class MockEventSource {
  static instances: MockEventSource[] = [];
  private listeners = new Map<string, Array<(e: MessageEvent<string>) => void>>();
  public closed = false;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent<string>) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (e: MessageEvent<string>) => void): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((fn) => fn !== listener),
    );
  }

  emit(type: string, data: string): void {
    const event = { data } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  close(): void {
    this.closed = true;
  }
}

describe('BreatheSafe frontend accessibility and core user flows', () => {
  const sampleReport = buildSampleReport(PRESET_CITIES[0]!);
  const samplePlan = buildRulesPlan(sampleReport, DEFAULT_HOUSEHOLD_PROFILE);
  const sampleChat = buildRulesChatResponse(
    sampleReport,
    DEFAULT_HOUSEHOLD_PROFILE,
    'How do I build an affordable DIY air purifier?',
  );

  beforeEach(() => {
    MockEventSource.instances = [];
    window.localStorage.clear();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: { latitude: 28.61, longitude: 77.21 },
          } as GeolocationPosition);
        }),
      },
    });

    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/air-quality')) {
          return new Response(JSON.stringify(sampleReport), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/advisor/plan')) {
          return new Response(JSON.stringify(samplePlan), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/advisor/chat')) {
          return new Response(JSON.stringify(sampleChat), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ cities: PRESET_CITIES }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the live reading, SSE updates, clipboard share, favorites, filters, and data table', async () => {
    render(<App />);

    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('heading', { level: 1, name: 'BreatheSafe' })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Air quality in New Delhi/i }),
      ).toBeInTheDocument();
    });

    // SSE stream pushes live update cleanly
    expect(MockEventSource.instances.length).toBeGreaterThan(0);
    act(() => {
      MockEventSource.instances[0]?.emit('air-quality', JSON.stringify(sampleReport));
    });

    // Live header controls: pause/resume, favorite, copy snapshot, refresh
    fireEvent.click(screen.getByRole('button', { name: /Pause updates/i }));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resume updates/i }));
    expect(screen.getByText('Live')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove New Delhi from saved cities/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Save New Delhi$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copy a summary of current air quality/i }));
    fireEvent.click(screen.getByRole('button', { name: /Refresh air quality now/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copy message/i }));

    // Action Plan category filter
    const communityFilter = screen.getByRole('button', { name: /^Community \(1\)/i });
    fireEvent.click(communityFilter);
    expect(communityFilter).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^All \(/i }));

    // Accessible SVG forecast chart & expandable HTML data table
    expect(
      screen.getByRole('img', { name: /24-hour PM2\.5 forecast/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show as table/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('updates HouseholdProfileForm fields, submits plan generation, switches cities, and runs geolocation', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Air quality in New Delhi/i }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Household size/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Who are you planning for/i), { target: { value: 'school_pta' } });
    fireEvent.change(screen.getByLabelText(/Home type/i), {
      target: { value: 'independent_house' },
    });
    fireEvent.change(screen.getByLabelText(/Cooking fuel/i), {
      target: { value: 'induction_electric' },
    });
    fireEvent.change(screen.getByLabelText(/Main way of getting around/i), {
      target: { value: 'public_transit' },
    });
    fireEvent.change(screen.getByLabelText(/Daily round trip/i), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText(/^Budget$/i), {
      target: { value: 'moderate' },
    });
    fireEvent.click(screen.getByLabelText(/We already own a HEPA purifier/i));
    fireEvent.click(screen.getByLabelText(/Asthma \/ COPD/i));
    fireEvent.change(screen.getByLabelText(/Anything specific today/i), {
      target: { value: 'School sports at 4 PM' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update my plan/i }));

    fireEvent.click(screen.getByRole('button', { name: 'London' }));
    fireEvent.click(screen.getByRole('button', { name: /Use my current browser location/i }));

    await waitFor(() => {
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });
  });

  it('supports WCAG 2.2 AA Arrow-key tablist, Impact Simulator controls, and Advisor Chat form', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Air quality in New Delhi/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /High Contrast/i }));
    expect(document.documentElement.dataset.contrast).toBe('high');
    fireEvent.click(screen.getByRole('button', { name: /Switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe('dark');

    const dashTab = screen.getByRole('tab', { name: /^Today$/i });
    const simTab = screen.getByRole('tab', { name: /Impact calculator/i });
    const chatTab = screen.getByRole('tab', { name: /Ask a question/i });

    expect(dashTab).toHaveAttribute('tabIndex', '0');
    expect(simTab).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(dashTab, { key: 'ArrowRight' });
    expect(simTab).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(screen.getByText(/Your household's PM2\.5 dose/i)).toBeInTheDocument();
    });

    // Adjust community slider & toggle pledge checkbox
    const slider = screen.getByLabelText(/Households taking part/i);
    fireEvent.change(slider, { target: { value: '250' } });
    const diyCheckbox = screen.getByLabelText(/Build a DIY box-fan filter/i);
    fireEvent.click(diyCheckbox);
    expect(diyCheckbox).not.toBeChecked();

    fireEvent.keyDown(simTab, { key: 'End' });
    expect(chatTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(chatTab, { key: 'ArrowLeft' });
    expect(simTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(simTab, { key: 'Home' });
    expect(dashTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(chatTab);

    // Quick prompt & manual chat form submission
    const chatInput = screen.getByLabelText(/Ask a question about air quality/i);
    fireEvent.change(chatInput, { target: { value: 'How do I make a DIY air purifier?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByText(/MERV-13 furnace filters/i)).toBeInTheDocument();
    });
  });

  it("opens the impact calculator with the plan's own actions selected", async () => {
    render(<App />);

    const openCalculator = await screen.findByRole('button', {
      name: /Add up these actions in the impact calculator/i,
    });
    fireEvent.click(openCalculator);

    expect(screen.getByRole('tab', { name: /Impact calculator/i })).toHaveAttribute('aria-selected', 'true');
    const selected = screen.getAllByRole('checkbox').filter((box) => (box as HTMLInputElement).checked);
    expect(selected).toHaveLength(samplePlan.recommendations.length);
  });

  it('supports WAI-ARIA combobox keyboard selection and Escape dismissal in LocationSelector', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Air quality in New Delhi/i }),
      ).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox', { name: /Search any city/i });
    fireEvent.change(combobox, { target: { value: 'Delhi' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: /Matching cities/i })).toBeInTheDocument();
    });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'ArrowUp' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(combobox, { target: { value: 'London' } });
    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: /Matching cities/i })).toBeInTheDocument();
    });
    fireEvent.keyDown(combobox, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('isolates rendering failures cleanly inside ErrorBoundary and supports reset', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <ThrowingWidget shouldThrow />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        /This section failed to load/i,
      );
      fireEvent.click(screen.getByRole('button', { name: /Reload View/i }));
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

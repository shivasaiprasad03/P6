// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRulesChatResponse } from '../shared/advisor/chatEngine.js';
import { buildRulesPlan } from '../shared/advisor/planEngine.js';
import { buildSampleReport } from '../shared/airQuality/sampleReport.js';
import { DEFAULT_HOUSEHOLD_PROFILE, PRESET_CITIES } from '../shared/constants.js';
import { App } from '../src/App.js';
import { clampNumber } from '../src/components/HouseholdProfileForm.js';
import { searchStatusText } from '../src/components/LocationSelector.js';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue.js';
import { MAX_FAVORITE_CITIES, readStoredFavorites } from '../src/hooks/useFavoriteCities.js';

const sampleReport = buildSampleReport(PRESET_CITIES[0]!);
const samplePlan = buildRulesPlan(sampleReport, DEFAULT_HOUSEHOLD_PROFILE);
const sampleChat = buildRulesChatResponse(sampleReport, DEFAULT_HOUSEHOLD_PROFILE, 'DIY air purifier?');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fetch stub for the API; `chatFails` makes the chat endpoint return a 503. */
function stubApi({ chatFails = false } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/air-quality')) return json(sampleReport);
      if (url.includes('/api/advisor/plan')) return json(samplePlan);
      if (url.includes('/api/advisor/chat')) {
        return chatFails ? json({ message: 'The advisor is busy. Try again shortly.' }, 503) : json(sampleChat);
      }
      return json({ cities: PRESET_CITIES.slice(0, 2) });
    }),
  );
}

/** Runs axe's WCAG 2.x A/AA rules. Colour contrast needs real layout, so it is checked in CSS review instead. */
async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

async function renderLoadedApp() {
  const view = render(<App />);
  await screen.findByRole('heading', { name: /Air quality in New Delhi/i });
  await screen.findByRole('heading', { name: samplePlan.headline });
  return view;
}

describe('WCAG checks across every section', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('EventSource', class {
      addEventListener() {}
      removeEventListener() {}
      close() {}
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    stubApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('has no axe violations on the Today, calculator and question tabs', async () => {
    const { container } = await renderLoadedApp();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole('tab', { name: /Impact calculator/i }));
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole('tab', { name: /Ask a question/i }));
    await expectNoAxeViolations(container);
  });

  it('makes each tab panel focusable and labelled by its tab', async () => {
    await renderLoadedApp();
    const panel = screen.getByRole('tabpanel', { name: /Today/i });
    expect(panel).toHaveAttribute('tabindex', '0');
  });

  it('does not put the ticking "updated … ago" clock in a live region', async () => {
    await renderLoadedApp();
    const clock = screen.getByText(/^Updated /);
    expect(clock.closest('[aria-live]')).toBeNull();
  });

  it('announces when a summary or message is copied', async () => {
    await renderLoadedApp();
    fireEvent.click(screen.getByRole('button', { name: /Copy a summary of current air quality/i }));
    await waitFor(() => {
      expect(screen.getByText('Air quality summary copied to the clipboard.')).toHaveAttribute('role', 'status');
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy message/i }));
    await waitFor(() => {
      expect(screen.getByText('Message copied to the clipboard.')).toBeInTheDocument();
    });
  });

  it('marks the external link as opening a new tab', async () => {
    await renderLoadedApp();
    const link = screen.getByRole('link', { name: /Open-Meteo\s*\(opens in a new tab\)/i });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps focus on the plan button while the plan updates', async () => {
    await renderLoadedApp();
    const submit = screen.getByRole('button', { name: /Update my plan/i });
    submit.focus();
    fireEvent.click(submit);

    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(submit);
    await waitFor(() => expect(submit).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.getByLabelText(/Anything specific today/i)).toHaveAccessibleDescription(
      /checks it against the forecast/i,
    );
  });

  it('keeps the question box usable and focused through a chat round trip', async () => {
    await renderLoadedApp();
    fireEvent.click(screen.getByRole('tab', { name: /Ask a question/i }));

    const input = screen.getByLabelText(/Ask a question about air quality/i);
    input.focus();
    fireEvent.change(input, { target: { value: 'How do I make a DIY air purifier?' } });
    fireEvent.submit(input.closest('form')!);

    expect(input).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Sending question/i })).toHaveAttribute('aria-disabled', 'true');

    await screen.findByText(/MERV-13 furnace filters/i);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: /^Send question$/i })).toBeInTheDocument();
  });

  it('links a failed answer to the question box as its error', async () => {
    stubApi({ chatFails: true });
    await renderLoadedApp();
    fireEvent.click(screen.getByRole('tab', { name: /Ask a question/i }));

    const input = screen.getByLabelText(/Ask a question about air quality/i);
    fireEvent.change(input, { target: { value: 'Is it safe to jog?' } });
    fireEvent.submit(input.closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/advisor is busy/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/advisor is busy/i);
  });

  it('gives the households slider a spoken value and announces totals once it settles', async () => {
    await renderLoadedApp();
    fireEvent.click(screen.getByRole('tab', { name: /Impact calculator/i }));

    const slider = screen.getByRole('slider', { name: /Households taking part/i });
    expect(slider).toHaveAttribute('aria-valuetext', '100 households');

    vi.useFakeTimers();
    fireEvent.change(slider, { target: { value: '1' } });
    expect(slider).toHaveAttribute('aria-valuetext', '1 household');
    fireEvent.change(slider, { target: { value: '250' } });

    const status = screen
      .getAllByRole('status')
      .find((el) => el.textContent?.includes('habits selected'));
    expect(status).toHaveTextContent('across 100 households');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(status).toHaveTextContent('across 250 households');
  });

  it('announces how many cities a search found', async () => {
    await renderLoadedApp();
    const combobox = screen.getByRole('combobox', { name: /Search any city/i });
    expect(combobox).not.toHaveAttribute('aria-controls');

    fireEvent.change(combobox, { target: { value: 'Del' } });
    const placeBar = screen.getByRole('region', { name: /Choose a city/i });
    await waitFor(() => {
      expect(within(placeBar).getByText('2 cities found.')).toBeInTheDocument();
    });
    expect(combobox).toHaveAttribute('aria-controls');
    expect(combobox).toHaveAccessibleDescription(/arrow keys/i);
  });
});

describe('Accessibility helpers', () => {
  it('builds search status text without announcing stale results', () => {
    expect(searchStatusText(true, null, 0, false)).toBe('Searching…');
    expect(searchStatusText(false, 'Offline', 0, true)).toBe('Offline');
    expect(searchStatusText(false, null, 3, false)).toBe('');
    expect(searchStatusText(false, null, 0, true)).toBe('No matching cities.');
    expect(searchStatusText(false, null, 1, true)).toBe('1 city found.');
  });

  it('clamps number fields and treats empty input as the minimum', () => {
    expect(clampNumber('', 1, 20)).toBe(1);
    expect(clampNumber('abc', 0, 250)).toBe(0);
    expect(clampNumber('99', 1, 20)).toBe(20);
    expect(clampNumber('-5', 0, 250)).toBe(0);
    expect(clampNumber('12.5', 0, 250)).toBe(12.5);
  });

  it('debounces a value', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 500), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    rerender({ v: 'c' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('c');
    vi.useRealTimers();
  });
});

describe('Stored favourite cities', () => {
  beforeEach(() => window.localStorage.clear());

  it('ignores invalid, duplicate and oversized entries', () => {
    const tampered = ['Delhi', 'Delhi', 42, '', 'x'.repeat(500), ...Array.from({ length: 40 }, (_, i) => `City ${i}`)];
    window.localStorage.setItem('breathesafe:favorite-cities:v1', JSON.stringify(tampered));

    const favorites = readStoredFavorites('New Delhi');
    expect(favorites[0]).toBe('Delhi');
    expect(new Set(favorites).size).toBe(favorites.length);
    expect(favorites.length).toBe(MAX_FAVORITE_CITIES);
    expect(favorites.every((name) => typeof name === 'string' && name.length <= 100)).toBe(true);
  });

  it('falls back to the default city for corrupt storage', () => {
    window.localStorage.setItem('breathesafe:favorite-cities:v1', '{not json');
    expect(readStoredFavorites('New Delhi')).toEqual(['New Delhi']);
    window.localStorage.setItem('breathesafe:favorite-cities:v1', '{"a":1}');
    expect(readStoredFavorites('New Delhi')).toEqual(['New Delhi']);
  });
});

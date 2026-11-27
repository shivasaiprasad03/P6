import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_HOUSEHOLD_PROFILE, PRESET_CITIES } from '../../shared/constants.js';
import type {
  ActionPlanResponse,
  AirQualityReport,
  CityLocation,
  HouseholdProfile,
} from '../../shared/types.js';
import { fetchAirQualityApi, generateActionPlanApi } from '../lib/apiClient.js';
import { useFavoriteCities } from './useFavoriteCities.js';
import { useLiveAirQualityStream } from './useLiveAirQualityStream.js';

const DEFAULT_CITY: CityLocation = PRESET_CITIES[0]!;

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * State for the "Today" view: the selected city, its readings and plan, the household
 * profile, live updates and saved cities.
 *
 * Every load is tagged with a sequence number, so when the user switches cities quickly a
 * slow response for an earlier city can never overwrite the newer one.
 */
export function useAirQualityDashboard() {
  const [selectedCity, setSelectedCity] = useState<CityLocation>(DEFAULT_CITY);
  const [profile, setProfile] = useState<HouseholdProfile>(DEFAULT_HOUSEHOLD_PROFILE);
  const [focusNote, setFocusNote] = useState('');
  const [report, setReport] = useState<AirQualityReport | null>(null);
  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [loadingAqi, setLoadingAqi] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(true);

  const loadSeq = useRef(0);
  const { isFavoriteCity, toggleFavoriteCity } = useFavoriteCities(DEFAULT_CITY.name);

  const handleLiveReport = useCallback((live: AirQualityReport) => {
    setReport(live);
    setLoadingAqi(false);
  }, []);

  const { lastSyncedAt, resetSyncClock } = useLiveAirQualityStream({
    city: selectedCity,
    enabled: liveEnabled,
    onReport: handleLiveReport,
  });

  const loadReport = useCallback(
    async (city: CityLocation, seq: number) => {
      setLoadingAqi(true);
      try {
        const next = await fetchAirQualityApi(city);
        if (seq !== loadSeq.current) return;
        setReport(next);
        resetSyncClock();
      } catch (err) {
        if (seq === loadSeq.current) setErrorMessage(errorText(err, 'Could not load air quality.'));
      } finally {
        if (seq === loadSeq.current) setLoadingAqi(false);
      }
    },
    [resetSyncClock],
  );

  const loadPlan = useCallback(
    async (city: CityLocation, household: HouseholdProfile, note: string, seq: number) => {
      setLoadingPlan(true);
      try {
        const next = await generateActionPlanApi({
          location: city,
          profile: household,
          focusNote: note.trim() || undefined,
        });
        if (seq === loadSeq.current) setPlan(next);
      } catch (err) {
        if (seq === loadSeq.current) setErrorMessage(errorText(err, 'Could not prepare a plan.'));
      } finally {
        if (seq === loadSeq.current) setLoadingPlan(false);
      }
    },
    [],
  );

  const loadCity = useCallback(
    (city: CityLocation, household: HouseholdProfile, note: string) => {
      const seq = ++loadSeq.current;
      setErrorMessage(null);
      void loadReport(city, seq);
      void loadPlan(city, household, note, seq);
    },
    [loadPlan, loadReport],
  );

  // Initial load only; later loads are triggered by user actions below.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    loadCity(DEFAULT_CITY, DEFAULT_HOUSEHOLD_PROFILE, '');
  }, [loadCity]);

  const selectCity = useCallback(
    (city: CityLocation) => {
      setSelectedCity(city);
      loadCity(city, profile, focusNote);
    },
    [focusNote, loadCity, profile],
  );

  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorMessage('Your browser cannot share its location. Please search for a city instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        selectCity({
          name: 'Your location',
          country: 'Current position',
          latitude: Number(coords.latitude.toFixed(4)),
          longitude: Number(coords.longitude.toFixed(4)),
        }),
      () => setErrorMessage('Location access was declined. Please search for a city instead.'),
      { timeout: 6000, maximumAge: 300_000 },
    );
  }, [selectCity]);

  const refreshAqi = useCallback(() => {
    setErrorMessage(null);
    void loadReport(selectedCity, loadSeq.current);
  }, [loadReport, selectedCity]);

  const regeneratePlan = useCallback(() => {
    setErrorMessage(null);
    void loadPlan(selectedCity, profile, focusNote, loadSeq.current);
  }, [focusNote, loadPlan, profile, selectedCity]);

  return {
    selectedCity,
    profile,
    focusNote,
    report,
    plan,
    loadingAqi,
    loadingPlan,
    errorMessage,
    liveEnabled,
    lastSyncedAt,
    isFavorite: isFavoriteCity(selectedCity.name),
    setProfile,
    setFocusNote,
    selectCity,
    locateMe,
    toggleFavorite: () => toggleFavoriteCity(selectedCity.name),
    toggleLive: () => setLiveEnabled((prev) => !prev),
    refreshAqi,
    regeneratePlan,
  };
}

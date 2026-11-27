import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_HOUSEHOLD_PROFILE, PRESET_CITIES } from '../../shared/constants.js';
import type {
  ActionPlanResponse,
  AirQualityReport,
  CityLocation,
  HouseholdProfile,
} from '../../shared/types.js';
import {
  fetchAirQualityApi,
  fetchHealth,
  generateActionPlanApi,
} from '../lib/apiClient.js';
import { useFavoriteCities } from './useFavoriteCities.js';
import { useLiveAirQualityStream } from './useLiveAirQualityStream.js';

const DEFAULT_CITY: CityLocation = PRESET_CITIES[0] ?? {
  name: 'New Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
};

/**
 * Orchestrates live air quality state, AI action plan generation, city selection,
 * browser geolocation, favorite persistence, and SSE stream subscriptions.
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
  const [aiMode, setAiMode] = useState<'gemini-genai' | 'local-intelligence'>(
    'local-intelligence',
  );
  const [liveEnabled, setLiveEnabled] = useState(true);

  const { isFavoriteCity, toggleFavoriteCity } = useFavoriteCities(DEFAULT_CITY.name);

  const handleLiveReport = useCallback((liveReport: AirQualityReport) => {
    setReport(liveReport);
    setLoadingAqi(false);
  }, []);

  const { secondsSinceSync, resetSyncClock } = useLiveAirQualityStream({
    city: selectedCity,
    enabled: liveEnabled,
    onReport: handleLiveReport,
  });

  const resetSyncRef = useRef(resetSyncClock);
  useEffect(() => {
    resetSyncRef.current = resetSyncClock;
  }, [resetSyncClock]);

  const fetchCityBundle = useCallback(
    async (city: CityLocation, currentProfile: HouseholdProfile, note: string) => {
      const [aqReport, actionPlan] = await Promise.all([
        fetchAirQualityApi(city),
        generateActionPlanApi({
          location: city,
          profile: currentProfile,
          focusNote: note.trim() || undefined,
        }),
      ]);
      return { aqReport, actionPlan };
    },
    [],
  );

  useEffect(() => {
    fetchHealth()
      .then((health) => setAiMode(health.aiMode))
      .catch(() => {
        // Retain default engine badge if health endpoint is unavailable
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCityBundle(DEFAULT_CITY, DEFAULT_HOUSEHOLD_PROFILE, '')
      .then(({ aqReport, actionPlan }) => {
        if (cancelled) return;
        setErrorMessage(null);
        setReport(aqReport);
        resetSyncRef.current();
        setPlan(actionPlan);
        setAiMode(actionPlan.engine);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load air quality intelligence.',
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingAqi(false);
        setLoadingPlan(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchCityBundle]);

  const selectCity = useCallback(
    (city: CityLocation) => {
      setSelectedCity(city);
      setErrorMessage(null);
      setLoadingAqi(true);
      setLoadingPlan(true);

      void fetchCityBundle(city, profile, focusNote)
        .then(({ aqReport, actionPlan }) => {
          setReport(aqReport);
          resetSyncRef.current();
          setPlan(actionPlan);
          setAiMode(actionPlan.engine);
        })
        .catch((err: unknown) => {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load air quality intelligence.',
          );
        })
        .finally(() => {
          setLoadingAqi(false);
          setLoadingPlan(false);
        });
    },
    [fetchCityBundle, focusNote, profile],
  );

  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorMessage('Browser geolocation is unavailable — please pick a city instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectCity({
          name: 'My Current Location',
          country: 'Local Area',
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        });
      },
      () => {
        setErrorMessage('Location permission denied — use the city search bar above.');
      },
      { timeout: 6000, maximumAge: 300_000 },
    );
  }, [selectCity]);

  const refreshAqi = useCallback(async () => {
    setLoadingAqi(true);
    setErrorMessage(null);
    try {
      const aqReport = await fetchAirQualityApi(selectedCity);
      setReport(aqReport);
      resetSyncRef.current();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to refresh air quality.');
    } finally {
      setLoadingAqi(false);
    }
  }, [selectedCity]);

  const regeneratePlan = useCallback(async () => {
    setLoadingPlan(true);
    setErrorMessage(null);
    try {
      const actionPlan = await generateActionPlanApi({
        location: selectedCity,
        profile,
        focusNote: focusNote.trim() || undefined,
      });
      setPlan(actionPlan);
      setAiMode(actionPlan.engine);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to generate action plan.');
    } finally {
      setLoadingPlan(false);
    }
  }, [focusNote, profile, selectedCity]);

  return {
    selectedCity,
    profile,
    focusNote,
    report,
    plan,
    loadingAqi,
    loadingPlan,
    errorMessage,
    aiMode,
    liveEnabled,
    secondsSinceSync,
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

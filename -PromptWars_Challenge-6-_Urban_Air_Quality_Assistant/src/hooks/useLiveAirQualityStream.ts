import { useEffect, useState } from 'react';
import type { AirQualityReport, CityLocation } from '../../shared/types.js';
import { fetchAirQualityApi, IS_STANDALONE } from '../lib/apiClient.js';

const POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the report fresh while `enabled` is true: subscribes to the server's SSE stream,
 * or polls Open-Meteo every minute in the static build. Also tracks seconds since the last update.
 */
export function useLiveAirQualityStream(params: {
  city: CityLocation;
  enabled: boolean;
  onReport: (report: AirQualityReport) => void;
}) {
  const { city, enabled, onReport } = params;
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceSync((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!enabled || !IS_STANDALONE) return;
    let active = true;
    const timer = setInterval(() => {
      fetchAirQualityApi(city)
        .then((report) => {
          if (!active) return;
          onReport(report);
          setSecondsSinceSync(0);
        })
        .catch(() => {
          // Keep showing the last good reading; the next poll will retry.
        });
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [city, enabled, onReport]);

  useEffect(() => {
    if (!enabled || IS_STANDALONE || typeof EventSource === 'undefined') {
      return;
    }

    const query = new URLSearchParams({
      lat: String(city.latitude),
      lon: String(city.longitude),
      name: city.name,
      country: city.country,
    });
    const stream = new EventSource(`/api/air-quality/stream?${query.toString()}`);

    const handleAirQuality = (event: MessageEvent<string>) => {
      try {
        const liveReport = JSON.parse(event.data) as AirQualityReport;
        onReport(liveReport);
        setSecondsSinceSync(0);
      } catch {
        // Ignore malformed SSE event frames
      }
    };

    stream.addEventListener('air-quality', handleAirQuality as EventListener);
    return () => {
      stream.removeEventListener('air-quality', handleAirQuality as EventListener);
      stream.close();
    };
  }, [city, enabled, onReport]);

  return {
    secondsSinceSync,
    resetSyncClock: () => setSecondsSinceSync(0),
  };
}

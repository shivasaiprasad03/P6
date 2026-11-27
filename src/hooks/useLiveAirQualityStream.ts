import { useCallback, useEffect, useState } from 'react';
import type { AirQualityReport, CityLocation } from '../../shared/types.js';
import { airQualityStreamUrl, fetchAirQualityApi, IS_STANDALONE } from '../lib/apiClient.js';

const STANDALONE_POLL_MS = 60_000;

/**
 * Keeps the report fresh while `enabled`: subscribes to the server's Server-Sent Events
 * stream, or polls Open-Meteo once a minute in the static build. Returns when the last
 * update arrived (a timestamp, so the whole page does not re-render every second).
 */
export function useLiveAirQualityStream({
  city,
  enabled,
  onReport,
}: {
  city: CityLocation;
  enabled: boolean;
  onReport: (report: AirQualityReport) => void;
}) {
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());
  const resetSyncClock = useCallback(() => setLastSyncedAt(Date.now()), []);

  useEffect(() => {
    if (!enabled) return;

    const deliver = (report: AirQualityReport) => {
      onReport(report);
      setLastSyncedAt(Date.now());
    };

    if (IS_STANDALONE) {
      let active = true;
      const timer = setInterval(() => {
        fetchAirQualityApi(city)
          .then((report) => active && deliver(report))
          .catch(() => {
            // Keep showing the last good reading; the next poll retries.
          });
      }, STANDALONE_POLL_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }

    if (typeof EventSource === 'undefined') return;
    const stream = new EventSource(airQualityStreamUrl(city));
    const onMessage = (event: MessageEvent<string>) => {
      try {
        deliver(JSON.parse(event.data) as AirQualityReport);
      } catch {
        // Ignore a malformed frame; the next one replaces it.
      }
    };
    stream.addEventListener('air-quality', onMessage as EventListener);
    return () => {
      stream.removeEventListener('air-quality', onMessage as EventListener);
      stream.close();
    };
  }, [city, enabled, onReport]);

  return { lastSyncedAt, resetSyncClock };
}

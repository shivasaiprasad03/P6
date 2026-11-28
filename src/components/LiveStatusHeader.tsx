import { useEffect, useState } from 'react';
import { Check, Heart, Pause, Play, RefreshCw, Share2 } from 'lucide-react';
import type { AirQualityReport } from '../../shared/types.js';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.js';

interface LiveStatusHeaderProps {
  report: AirQualityReport;
  loading: boolean;
  liveEnabled: boolean;
  /** Epoch ms of the last successful update. */
  lastSyncedAt: number;
  isFavorite: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  onToggleFavorite: () => void;
}

const AGE_TICK_MS = 10_000;

/** Re-renders only this header every few seconds to keep the "updated … ago" text current. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatAge(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

/**
 * City heading with the live/paused status, last update time, and quick actions
 * (pause updates, save city, copy a summary, refresh).
 */
export function LiveStatusHeader({
  report,
  loading,
  liveEnabled,
  lastSyncedAt,
  isFavorite,
  onToggleLive,
  onRefresh,
  onToggleFavorite,
}: LiveStatusHeaderProps) {
  const { copied, copy } = useCopyToClipboard();
  const now = useNow(AGE_TICK_MS);
  const secondsSinceSync = Math.max(0, Math.round((now - lastSyncedAt) / 1000));
  const { current, location, weather, safestWindow } = report;

  const updatedAt = new Date(report.fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleShareSnapshot(): void {
    const summary =
      `Air quality in ${location.name}: US AQI ${current.usAqi} (${current.label}). ` +
      `PM2.5 ${current.pm25} µg/m³, PM10 ${current.pm10} µg/m³. ` +
      (weather ? `${weather.temperatureC}°C, wind ${weather.windSpeedKmh} km/h. ` : '') +
      `Best time outside: ${safestWindow.startLabel}–${safestWindow.endLabel}.`;
    void copy(summary);
  }

  return (
    <div className="city-header">
      <div>
        <p className="status-line">
          <span className={`status-dot ${liveEnabled ? 'is-live' : 'is-paused'}`} aria-hidden="true" />
          <span className="status-label">{liveEnabled ? 'Live' : 'Paused'}</span>
          <span className="status-sep" aria-hidden="true">
            ·
          </span>
          {/* Not a live region: this text changes every few seconds and would interrupt readers. */}
          <span>
            Updated {updatedAt} ({formatAge(secondsSinceSync)})
          </span>
        </p>
        <h2 id="aqi-overview-heading" className="city-name">
          <span className="sr-only">Air quality in</span> {location.name}
        </h2>
        <p className="city-country">
          {location.admin1 ? `${location.admin1}, ` : ''}
          {location.country}
        </p>
      </div>

      <div className="city-actions no-print">
        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleLive}
        >
          {liveEnabled ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {liveEnabled ? 'Pause updates' : 'Resume updates'}
        </button>

        <button
          type="button"
          className={`btn btn-icon ${isFavorite ? 'is-on' : ''}`}
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite ? `Remove ${location.name} from saved cities` : `Save ${location.name}`
          }
          title={isFavorite ? 'Saved' : 'Save city'}
        >
          <Heart size={16} aria-hidden="true" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={handleShareSnapshot}
          aria-label="Copy a summary of current air quality"
          title={copied ? 'Copied' : 'Copy summary'}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh air quality now"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" className={loading ? 'spin' : ''} />
        </button>
      </div>

      <p className="sr-only" role="status">
        {copied ? 'Air quality summary copied to the clipboard.' : ''}
      </p>
    </div>
  );
}

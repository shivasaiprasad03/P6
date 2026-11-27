import { AQI_BANDS } from '../../shared/constants.js';

interface AqiScaleProps {
  value: number;
  label: string;
}

/** Upper bound drawn on the scale; readings above it pin to the end. */
const SCALE_MAX = 400;

/**
 * Horizontal US AQI scale with segments sized to each band's real range
 * and a marker at the current reading.
 */
export function AqiScale({ value, label }: AqiScaleProps) {
  const markerPct = Math.min(100, Math.max(0, (value / SCALE_MAX) * 100));

  return (
    <div className="aqi-scale" role="img" aria-label={`AQI ${value} on the US scale: ${label}`}>
      <div className="aqi-scale-track">
        {AQI_BANDS.map((band) => {
          const upper = Math.min(band.max, SCALE_MAX);
          const width = ((upper - band.min + 1) / (SCALE_MAX + 1)) * 100;
          return (
            <span
              key={band.severity}
              className={`aqi-scale-seg sev-bg-${band.severity}`}
              style={{ width: `${width}%` }}
            />
          );
        })}
        <span className="aqi-scale-marker" style={{ left: `${markerPct}%` }} />
      </div>
      <div className="aqi-scale-ticks" aria-hidden="true">
        {[0, 50, 100, 150, 200, 300].map((tick) => (
          <span key={tick} style={{ left: `${(tick / SCALE_MAX) * 100}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

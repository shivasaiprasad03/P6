import { Cloud, CloudFog, CloudRain, Sun } from 'lucide-react';
import { AIR_QUALITY_CONSTANTS, classifyAqi } from '../../shared/constants.js';
import type { AirQualityReport, WeatherConditions } from '../../shared/types.js';
import { AqiScale } from './AqiScale.js';
import { ForecastChart } from './ForecastChart.js';
import { LiveStatusHeader } from './LiveStatusHeader.js';

interface AirQualityOverviewProps {
  report: AirQualityReport | null;
  loading: boolean;
  liveEnabled: boolean;
  secondsSinceSync: number;
  isFavorite: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  onToggleFavorite: () => void;
}

const RISK_LABELS: Record<AirQualityReport['inversionRisk']['level'], string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
};

function WeatherGlyph({ icon }: { icon: WeatherConditions['conditionIcon'] }) {
  switch (icon) {
    case 'clear':
      return <Sun size={18} aria-hidden="true" />;
    case 'rain':
      return <CloudRain size={18} aria-hidden="true" />;
    case 'cloudy':
      return <Cloud size={18} aria-hidden="true" />;
    default:
      return <CloudFog size={18} aria-hidden="true" />;
  }
}

/**
 * The "Today" overview: city heading and live controls, the current AQI reading with scale,
 * weather, pollutant concentrations, best outdoor window, build-up risk, and the 24-hour forecast.
 */
export function AirQualityOverview({
  report,
  loading,
  liveEnabled,
  secondsSinceSync,
  isFavorite,
  onToggleLive,
  onRefresh,
  onToggleFavorite,
}: AirQualityOverviewProps) {
  if (loading && !report) {
    return (
      <section className="panel panel-loading" aria-busy="true" aria-live="polite">
        <h2 className="panel-title">Loading current readings…</h2>
        <p className="muted">Fetching air quality, weather and the next 24 hours.</p>
      </section>
    );
  }

  if (!report) {
    return null;
  }

  const { current, location, weather, safestWindow, inversionRisk, hourlyForecast } = report;
  const band = classifyAqi(current.usAqi);
  const riskIsHigh = inversionRisk.level === 'high' || inversionRisk.level === 'severe';

  const pollutants = [
    { key: 'PM2.5', name: 'Fine particles', value: current.pm25 },
    { key: 'PM10', name: 'Coarse particles', value: current.pm10 },
    { key: 'NO₂', name: 'Nitrogen dioxide', value: current.no2 },
    { key: 'O₃', name: 'Ozone', value: current.ozone },
    { key: 'SO₂', name: 'Sulphur dioxide', value: current.so2 },
    { key: 'CO', name: 'Carbon monoxide', value: current.co },
  ];

  return (
    <section className="overview stack-md" aria-labelledby="aqi-overview-heading">
      <LiveStatusHeader
        report={report}
        loading={loading}
        liveEnabled={liveEnabled}
        secondsSinceSync={secondsSinceSync}
        isFavorite={isFavorite}
        onToggleLive={onToggleLive}
        onRefresh={onRefresh}
        onToggleFavorite={onToggleFavorite}
      />

      {report.source === 'winter-smog-fallback' && (
        <div className="notice notice-warn" role="status">
          The live feed couldn&apos;t be reached, so these are <strong>sample values</strong> typical
          for {location.name} in winter. Refresh to try again.
        </div>
      )}

      <div className="reading-grid">
        <div className={`panel reading sev-${current.severity}`} aria-live="polite">
          <p className="eyebrow">US AQI · now</p>
          <div className="reading-figure">
            <span className="reading-number">{current.usAqi}</span>
            <span className="reading-band">{band.label}</span>
          </div>
          <p className="reading-guidance">{band.guidance}</p>
          <AqiScale value={current.usAqi} label={band.label} />
          <p className="reading-footnote">
            PM2.5 is <strong>{current.whoPm25Multiple}×</strong> the WHO 24-hour guideline of{' '}
            {AIR_QUALITY_CONSTANTS.whoPm25Guideline24h} µg/m³. Breathing this all day is roughly
            like smoking{' '}
            <strong>
              {current.cigaretteEquivalentPerDay} cigarette
              {current.cigaretteEquivalentPerDay === 1 ? '' : 's'}
            </strong>{' '}
            (Berkeley Earth estimate).
          </p>
        </div>

        <div className="panel weather">
          <h3 className="panel-label">
            <WeatherGlyph icon={weather.conditionIcon} />
            {weather.conditionLabel}
          </h3>
          <dl className="facts">
            <div>
              <dt>Temperature</dt>
              <dd>{weather.temperatureC} °C</dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{weather.humidityPct} %</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>{weather.windSpeedKmh} km/h</dd>
            </div>
            <div>
              <dt>UV index</dt>
              <dd>{weather.uvIndex}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-label">Pollutants (µg/m³)</h3>
        <dl className="pollutants" aria-label="Pollutant concentrations">
          {pollutants.map((p) => (
            <div key={p.key} className="pollutant">
              <dt>
                <span className="pollutant-key">{p.key}</span>
                <span className="pollutant-name">{p.name}</span>
              </dt>
              <dd>{p.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="note-grid">
        <div className="note">
          <h3 className="note-title">
            Best time outside: {safestWindow.startLabel}–{safestWindow.endLabel}
          </h3>
          <p>
            Average AQI {safestWindow.avgAqi}, PM2.5 {safestWindow.avgPm25} µg/m³.{' '}
            {safestWindow.advisory}
          </p>
        </div>
        <div className={`note ${riskIsHigh ? 'note-warn' : ''}`}>
          <h3 className="note-title">
            Pollution build-up risk: {RISK_LABELS[inversionRisk.level]}
          </h3>
          <p>
            {inversionRisk.summary} Worst hours: {inversionRisk.peakHours}.
          </p>
        </div>
      </div>

      <ForecastChart
        cityName={location.name}
        hourlyForecast={hourlyForecast}
        safestWindow={safestWindow}
      />
    </section>
  );
}

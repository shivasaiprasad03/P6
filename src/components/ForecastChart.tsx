import { useState } from 'react';
import { Table as TableIcon } from 'lucide-react';
import { AIR_QUALITY_CONSTANTS, classifyAqi } from '../../shared/constants.js';
import type { HourlyAirPoint, SafeOutdoorWindow } from '../../shared/types.js';

interface ForecastChartProps {
  cityName: string;
  hourlyForecast: HourlyAirPoint[];
  safestWindow: SafeOutdoorWindow;
}

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 16, right: 8, bottom: 26, left: 34 };

function niceMax(value: number): number {
  const steps = [50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  return steps.find((s) => s >= value) ?? Math.ceil(value / 250) * 250;
}

/**
 * 24-hour PM2.5 bar chart (bars coloured by AQI band, WHO guideline marked,
 * best two-hour window highlighted) with a toggleable data table.
 */
export function ForecastChart({ cityName, hourlyForecast, safestWindow }: ForecastChartProps) {
  const [showTable, setShowTable] = useState(false);

  const yMax = niceMax(Math.max(40, ...hourlyForecast.map((h) => h.pm25)));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, hourlyForecast.length);
  const barW = Math.max(4, slot - 5);
  const y = (v: number) => PAD.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const whoLimit = AIR_QUALITY_CONSTANTS.whoPm25Guideline24h;

  const bestStart = hourlyForecast.findIndex((h) => h.time === safestWindow.startTime);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3 className="panel-title">Next 24 hours</h3>
          <p className="muted">
            Hourly PM2.5 in µg/m³. The shaded hours are the cleanest two-hour stretch.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm no-print"
          aria-expanded={showTable}
          onClick={() => setShowTable((prev) => !prev)}
        >
          <TableIcon size={14} aria-hidden="true" />
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </div>

      <svg
        className="chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="forecast-chart-title forecast-chart-desc"
      >
        <title id="forecast-chart-title">24-hour PM2.5 forecast for {cityName}</title>
        <desc id="forecast-chart-desc">
          Hourly PM2.5 bars for the next 24 hours. The cleanest two hours are{' '}
          {safestWindow.startLabel} to {safestWindow.endLabel}, averaging {safestWindow.avgPm25}{' '}
          micrograms per cubic metre.
        </desc>

        {bestStart >= 0 && (
          <rect
            className="chart-best"
            x={PAD.left + bestStart * slot}
            y={PAD.top}
            width={slot * Math.min(2, hourlyForecast.length - bestStart)}
            height={plotH}
          />
        )}

        {gridLines.map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={PAD.left - 6} y={y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {hourlyForecast.map((point, idx) => {
          const top = y(point.pm25);
          const h = Math.max(2, PAD.top + plotH - top);
          const band = classifyAqi(point.usAqi);
          const x = PAD.left + idx * slot + (slot - barW) / 2;
          return (
            <g key={point.time}>
              <rect
                className={`chart-bar sev-fill-${band.severity}`}
                x={x}
                y={PAD.top + plotH - h}
                width={barW}
                height={h}
                rx={2}
              >
                <title>{`${point.hourLabel}: PM2.5 ${point.pm25} µg/m³, AQI ${point.usAqi} (${band.shortLabel})`}</title>
              </rect>
              {idx % 3 === 0 && (
                <text className="chart-axis" x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle">
                  {point.hourLabel}
                </text>
              )}
            </g>
          );
        })}

        {whoLimit < yMax && (
          <g>
            <line
              className="chart-who"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(whoLimit)}
              y2={y(whoLimit)}
            />
            <text className="chart-who-label" x={WIDTH - PAD.right} y={y(whoLimit) - 5} textAnchor="end">
              WHO guideline {whoLimit}
            </text>
          </g>
        )}
      </svg>

      {showTable && (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Hourly air quality forecast for {cityName}</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">US AQI</th>
                <th scope="col">PM2.5</th>
                <th scope="col">PM10</th>
                <th scope="col">NO₂</th>
                <th scope="col">Category</th>
              </tr>
            </thead>
            <tbody>
              {hourlyForecast.map((pt) => (
                <tr key={pt.time}>
                  <td>{pt.hourLabel}</td>
                  <td>{pt.usAqi}</td>
                  <td>{pt.pm25}</td>
                  <td>{pt.pm10}</td>
                  <td>{pt.no2}</td>
                  <td>{classifyAqi(pt.usAqi).shortLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

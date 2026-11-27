import type {
  HourlyAirPoint,
  InversionRisk,
  SafeOutdoorWindow,
  WeatherConditions,
} from '../../../shared/types.js';

const PM25_AQI_BREAKPOINTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 400],
  [325.5, 500.4, 401, 500],
];

/**
 * Converts ambient PM2.5 (µg/m³) to US EPA AQI using piecewise-linear breakpoints.
 */
export function pm25ToUsAqi(pm25: number): number {
  const truncated = Math.max(0, Math.floor(pm25 * 10) / 10);
  for (const [cLow, cHigh, iLow, iHigh] of PM25_AQI_BREAKPOINTS) {
    if (truncated <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (truncated - cLow) + iLow);
    }
  }
  return 500;
}

/**
 * Formats an ISO-8601 hourly timestamp (`YYYY-MM-DDTHH:MM`) into a compact 12-hour label.
 */
export function formatHourLabel(isoTime: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoTime);
  if (!match) return isoTime;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${suffix}`;
}

/**
 * Finds the safest contiguous 2-hour window in the next 24h for necessary outdoor
 * errands or brief indoor cross-ventilation.
 */
export function computeSafestOutdoorWindow(hourly: HourlyAirPoint[]): SafeOutdoorWindow {
  const firstPoint = hourly[0];
  if (hourly.length < 2 || !firstPoint) {
    const fallbackAqi = firstPoint?.usAqi ?? 150;
    return {
      startLabel: '2 PM',
      endLabel: '4 PM',
      avgAqi: fallbackAqi,
      avgPm25: firstPoint?.pm25 ?? 55,
      advisory:
        'Keep outdoor trips short and wear a fitted N95 respirator if AQI exceeds 150.',
      ventilationSafe: fallbackAqi <= 100,
    };
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < hourly.length - 1; i += 1) {
    const current = hourly[i];
    const next = hourly[i + 1];
    if (!current || !next) continue;

    const avgPm25 = (current.pm25 + next.pm25) / 2;
    const avgAqi = (current.usAqi + next.usAqi) / 2;
    const score = avgPm25 * 1.4 + avgAqi * 0.6;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const start = hourly[bestIndex] ?? firstPoint;
  const pairB = hourly[bestIndex + 1] ?? start;
  const end = hourly[Math.min(bestIndex + 2, hourly.length - 1)] ?? pairB;
  const avgAqi = Math.round((start.usAqi + pairB.usAqi) / 2);
  const avgPm25 = Number(((start.pm25 + pairB.pm25) / 2).toFixed(1));
  const ventilationSafe = avgAqi <= 115;

  return {
    startLabel: start.hourLabel,
    endLabel: end.hourLabel,
    avgAqi,
    avgPm25,
    advisory: buildWindowAdvisory(avgAqi, start.hourLabel, end.hourLabel),
    ventilationSafe,
  };
}

function buildWindowAdvisory(avgAqi: number, startLabel: string, endLabel: string): string {
  if (avgAqi <= 75) {
    return 'Good window for 20–30 minutes of cross-ventilation and outdoor play.';
  }
  if (avgAqi <= 115) {
    return 'Brief 10–15 minute cross-ventilation is acceptable; keep HEPA/DIY filtration ready afterward.';
  }
  if (avgAqi <= 175) {
    return `Avoid opening windows; schedule essential school runs or groceries during ${startLabel}–${endLabel} with N95 masks.`;
  }
  return 'Severe smog persists all day — keep windows sealed and run indoor filtration continuously.';
}

/**
 * Estimates winter smog thermal inversion trapping based on diurnal PM2.5 swing
 * (night/early-morning trapping vs afternoon dispersion) and absolute severity.
 */
export function assessInversionRisk(
  currentAqi: number,
  hourly: HourlyAirPoint[],
): InversionRisk {
  const pmValues = hourly.map((h) => h.pm25);
  const peakPm = pmValues.length > 0 ? Math.max(...pmValues) : currentAqi * 0.4;
  const troughPm = pmValues.length > 0 ? Math.min(...pmValues) : currentAqi * 0.25;
  const diurnalRatio = troughPm > 0 ? peakPm / troughPm : 1.5;

  const peakPoint = hourly.reduce<HourlyAirPoint | undefined>(
    (max, item) => (!max || item.pm25 > max.pm25 ? item : max),
    undefined,
  );
  const peakHours = peakPoint
    ? `Around ${peakPoint.hourLabel} (late evening & early morning trapping)`
    : '8 PM – 9 AM';

  if (currentAqi >= 200 || peakPm >= 130) {
    return {
      level: 'severe',
      summary:
        'Strong winter thermal inversion is trapping vehicle exhaust and heating emissions near street level with very low wind dispersion.',
      peakHours,
    };
  }

  if (currentAqi >= 130 || (diurnalRatio >= 1.55 && peakPm >= 55)) {
    return {
      level: 'high',
      summary:
        'Elevated boundary-layer trapping expected overnight and during morning commutes; afternoon sun offers partial dispersion.',
      peakHours,
    };
  }

  if (currentAqi >= 75) {
    return {
      level: 'moderate',
      summary:
        'Moderate urban haze buildup during rush hours. Shift vigorous activity and airing-out to the midday dip.',
      peakHours,
    };
  }

  return {
    level: 'low',
    summary:
      'Active atmospheric dispersion is keeping surface pollution low. Good time to refresh indoor air.',
    peakHours,
  };
}

/**
 * Maps Open-Meteo WMO weather codes and current AQI/wind speed to a human-readable
 * winter-smog condition label and icon identifier.
 */
export function mapWeatherCondition(
  weatherCode: number | undefined,
  currentAqi: number,
  windSpeedKmh: number,
): Pick<WeatherConditions, 'conditionLabel' | 'conditionIcon'> {
  if (currentAqi >= 151 && windSpeedKmh <= 10) {
    return { conditionLabel: 'Smoky haze', conditionIcon: 'haze' };
  }
  if (weatherCode !== undefined) {
    if (weatherCode >= 51 && weatherCode <= 99) {
      return { conditionLabel: 'Rain / washout', conditionIcon: 'rain' };
    }
    if (weatherCode === 45 || weatherCode === 48) {
      return { conditionLabel: 'Winter fog & smog', conditionIcon: 'fog' };
    }
    if (weatherCode >= 1 && weatherCode <= 3) {
      return {
        conditionLabel: currentAqi >= 101 ? 'Hazy overcast' : 'Partly cloudy',
        conditionIcon: currentAqi >= 101 ? 'haze' : 'cloudy',
      };
    }
  }
  return currentAqi >= 101
    ? { conditionLabel: 'Urban haze', conditionIcon: 'haze' }
    : { conditionLabel: 'Clear dispersion', conditionIcon: 'clear' };
}

/**
 * Estimates contextual global pollution rank and wind-dispersion commentary.
 */
export function estimateGlobalRank(
  cityName: string,
  usAqi: number,
  windSpeedKmh: number,
): { rank: number; percentileNote: string } {
  const rank =
    usAqi >= 300
      ? Math.max(1, Math.round(8 - (usAqi - 300) / 35))
      : usAqi >= 200
        ? Math.max(4, Math.round(35 - (usAqi - 200) * 0.28))
        : usAqi >= 150
          ? Math.max(25, Math.round(95 - (usAqi - 150) * 1.2))
          : usAqi >= 100
            ? Math.max(96, Math.round(240 - (usAqi - 100) * 2.8))
            : Math.max(250, Math.round(1200 - usAqi * 9));

  const windNote =
    windSpeedKmh <= 7
      ? `Low wind (${windSpeedKmh} km/h) is trapping winter smog near ground level.`
      : windSpeedKmh <= 15
        ? `Light breeze (${windSpeedKmh} km/h) provides partial afternoon dispersion.`
        : `Brisk wind (${windSpeedKmh} km/h) is actively dispersing street-level pollution.`;

  const percentileNote =
    usAqi >= 151
      ? `Currently, ${cityName} ranks near #${rank} among the most polluted urban areas globally. ${windNote}`
      : `${cityName} currently sits around #${rank} globally for urban air pollution. ${windNote}`;

  return { rank, percentileNote };
}

import type { NextFunction, Request, Response } from 'express';
import { PRESET_CITIES } from '../../shared/constants.js';
import { airQualityQuerySchema, citySearchQuerySchema } from '../../shared/schemas.js';
import type { CityLocation } from '../../shared/types.js';
import { SSE_CONFIG } from '../config/constants.js';
import { getServerConfig } from '../config/env.js';
import { getAirQualityReport, searchCities } from '../services/airQualityService.js';
import { logger } from '../utils/logger.js';

function parseLocationQuery(query: Request['query']): CityLocation {
  const parsed = airQualityQuerySchema.parse(query);
  return {
    name: parsed.name || 'Selected location',
    country: parsed.country || 'Unknown',
    latitude: parsed.lat,
    longitude: parsed.lon,
  };
}

/** Handles `GET /api/cities/presets` returning curated winter-smog reference cities. */
export function getPresetCities(_req: Request, res: Response): void {
  res.json({ cities: PRESET_CITIES });
}

/** Handles `GET /api/cities/search` with strict query validation and cached geocoding. */
export async function searchCitiesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = citySearchQuerySchema.parse(req.query);
    const cities = await searchCities(parsed.q);
    res.json({ cities });
  } catch (err) {
    next(err);
  }
}

/** Handles `GET /api/air-quality` returning live or cached AQI, weather, and forecast analytics. */
export async function getAirQualityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const location = parseLocationQuery(req.query);
    const report = await getAirQualityReport(location);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

function writeSseEvent(res: Response, event: string, payload: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Handles `GET /api/air-quality/stream` using Server-Sent Events.
 * On Vercel serverless runtimes, sends an immediate reading + `retry` directive and closes cleanly;
 * on self-hosted Node servers, streams periodic refreshes with keep-alive heartbeats.
 */
export async function streamAirQualityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const location = parseLocationQuery(req.query);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const pushUpdate = async () => {
      try {
        const report = await getAirQualityReport(location);
        writeSseEvent(res, 'air-quality', report);
      } catch (err) {
        logger.warn('SSE air-quality refresh failed', {
          city: location.name,
          reason: err instanceof Error ? err.message : 'unknown_error',
        });
        writeSseEvent(res, 'error', { message: 'Transient refresh error' });
      }
    };

    await pushUpdate();

    if (getServerConfig().isVercel) {
      if (!res.writableEnded) {
        res.write(`retry: ${SSE_CONFIG.serverlessRetryMs}\n\n`);
        res.end();
      }
      return;
    }

    const refreshTimer = setInterval(() => {
      void pushUpdate();
    }, SSE_CONFIG.refreshIntervalMs);
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    }, SSE_CONFIG.heartbeatIntervalMs);

    req.on('close', () => {
      clearInterval(refreshTimer);
      clearInterval(heartbeatTimer);
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (err) {
    next(err);
  }
}

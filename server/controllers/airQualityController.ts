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

/** Open SSE streams per client IP, used to cap long-lived connections. */
const openStreams = new Map<string, number>();
let openStreamsTotal = 0;

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/** Reserves a stream slot for the client; returns false when a cap is reached. */
function acquireStreamSlot(key: string): boolean {
  const current = openStreams.get(key) ?? 0;
  if (current >= SSE_CONFIG.maxStreamsPerClient || openStreamsTotal >= SSE_CONFIG.maxStreamsTotal) {
    return false;
  }
  openStreams.set(key, current + 1);
  openStreamsTotal += 1;
  return true;
}

function releaseStreamSlot(key: string): void {
  const remaining = (openStreams.get(key) ?? 1) - 1;
  if (remaining > 0) openStreams.set(key, remaining);
  else openStreams.delete(key);
  openStreamsTotal = Math.max(0, openStreamsTotal - 1);
}

/** Number of currently open SSE streams (exposed for tests and health telemetry). */
export function openStreamCount(): number {
  return openStreamsTotal;
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
    const isServerless = getServerConfig().isVercel;

    // Long-lived streams are capped per client before any upstream work is done.
    const key = clientKey(req);
    if (!isServerless && !acquireStreamSlot(key)) {
      res.setHeader('Retry-After', String(Math.ceil(SSE_CONFIG.serverlessRetryMs / 1000)));
      res.status(429).json({
        error: 'too_many_streams',
        message: 'Too many live updates are open. Close another tab and try again.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const timers: ReturnType<typeof setInterval>[] = [];
    let closed = false;
    // Registered before the first await, so a client that leaves early still frees its slot.
    req.on('close', () => {
      closed = true;
      timers.forEach(clearInterval);
      if (!isServerless) releaseStreamSlot(key);
      if (!res.writableEnded) res.end();
    });

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

    if (isServerless) {
      if (!res.writableEnded) {
        res.write(`retry: ${SSE_CONFIG.serverlessRetryMs}\n\n`);
        res.end();
      }
      return;
    }

    if (closed) return;
    timers.push(
      setInterval(() => {
        void pushUpdate();
      }, SSE_CONFIG.refreshIntervalMs),
      setInterval(() => {
        if (!res.writableEnded) res.write(': keep-alive\n\n');
      }, SSE_CONFIG.heartbeatIntervalMs),
    );
  } catch (err) {
    next(err);
  }
}

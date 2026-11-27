import type { NextFunction, Request, Response } from 'express';
import { RATE_LIMIT_DEFAULTS } from '../config/constants.js';

interface RateBucket {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxTrackedClients?: number;
  message?: string;
}

/**
 * Memory-bounded sliding-window rate limiter middleware.
 * Protects GenAI and external API proxy endpoints from abuse and runaway token cost.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();
  const maxClients = options.maxTrackedClients ?? RATE_LIMIT_DEFAULTS.maxTrackedClients;

  return function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let bucket = buckets.get(clientIp);
    if (!bucket) {
      if (buckets.size >= maxClients) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) {
          buckets.delete(oldestKey);
        }
      }
      bucket = { timestamps: [] };
      buckets.set(clientIp, bucket);
    }

    // Drop timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(0, options.maxRequests - bucket.timestamps.length);
    res.setHeader('RateLimit-Limit', String(options.maxRequests));

    if (bucket.timestamps.length >= options.maxRequests) {
      const oldestInWindow = bucket.timestamps[0] ?? now;
      const retryAfterSec = Math.max(
        1,
        Math.ceil((oldestInWindow + options.windowMs - now) / 1000),
      );
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message:
          options.message ??
          'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    bucket.timestamps.push(now);
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining - 1)));
    next();
  };
}

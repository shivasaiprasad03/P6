import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { NETWORK_LIMITS } from './config/constants.js';
import { getServerConfig } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createApiRouter, type ApiRouterOptions } from './routes/api.js';
import { CorsOriginError } from './utils/errors.js';

export interface AppConfig {
  allowedOrigins?: string[];
  apiOptions?: ApiRouterOptions;
  serveStatic?: boolean;
}

function configureSecurityHeaders(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
    );
    next();
  });
}

function configureCors(app: Express, allowedOrigins: Set<string>): void {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new CorsOriginError());
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'Retry-After'],
      maxAge: 600,
    }),
  );
}

function configureStaticClient(app: Express, shouldServe: boolean): void {
  const clientDistDir = path.resolve(process.cwd(), 'dist', 'client');
  if (!shouldServe || !fs.existsSync(clientDistDir)) {
    return;
  }

  app.use(
    express.static(clientDistDir, {
      maxAge: '7d',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

/**
 * Creates a configured Express application with defense-in-depth security headers,
 * strict CORS allowlisting, compression, API routing, and optional static SPA hosting.
 */
export function createApp(config: AppConfig = {}): Express {
  const env = getServerConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);

  configureSecurityHeaders(app);

  const origins =
    config.allowedOrigins && config.allowedOrigins.length > 0
      ? config.allowedOrigins
      : env.allowedOrigins;
  configureCors(app, new Set(origins));

  app.use(compression());
  app.use(express.json({ limit: NETWORK_LIMITS.jsonBodyLimit, strict: true }));

  app.use('/api', createApiRouter(config.apiOptions));
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'API endpoint not found.',
    });
  });

  const shouldServeStatic = config.serveStatic ?? (env.isProduction && !env.isVercel);
  configureStaticClient(app, shouldServeStatic);

  app.use(errorHandler);
  return app;
}

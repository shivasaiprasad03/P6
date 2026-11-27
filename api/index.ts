import { createApp } from '../server/app.js';

/**
 * Vercel Serverless Function entrypoint.
 * Static Vite assets are served directly by Vercel's CDN from `dist/client`,
 * while all `/api/*` routes are handled by the hardened Express application.
 */
const app = createApp({ serveStatic: false });

export default app;

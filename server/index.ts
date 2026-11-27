import 'dotenv/config';
import { createApp } from './app.js';
import { NETWORK_LIMITS } from './config/constants.js';
import { getServerConfig } from './config/env.js';
import { logger } from './utils/logger.js';

const config = getServerConfig();
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('BreatheSafe API listening', {
    port: config.port,
    aiMode: config.geminiEnabled ? 'gemini' : 'rules',
  });
});

function shutdown(signal: string): void {
  logger.info('Graceful shutdown initiated', { signal });
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), NETWORK_LIMITS.shutdownGraceMs).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

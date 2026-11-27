import { getServerConfig } from '../config/env.js';

/**
 * Lightweight structured JSON logger for server observability.
 * Suppresses verbose output during test runs and never logs raw secrets.
 */
type LogLevel = 'info' | 'warn' | 'error';

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (getServerConfig().isTest) {
    return;
  }

  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  const serialized = JSON.stringify(record);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};

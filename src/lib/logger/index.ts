import { ConsoleLogger } from "./console-logger";
import type { Logger, LogLevel } from "./types";

const VALID_LEVELS: ReadonlySet<string> = new Set(["debug", "info", "warn", "error"]);

function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw !== undefined && VALID_LEVELS.has(raw)) return raw as LogLevel;
  if (raw !== undefined) {
    console.warn(`[logger] Invalid LOG_LEVEL="${raw}", falling back to "info"`);
  }
  return "info";
}

const LOG_LEVEL = parseLogLevel(process.env.LOG_LEVEL);

export function createLogger(name: string): Logger {
  return new ConsoleLogger(name, LOG_LEVEL);
}

export type { Logger, LogLevel } from "./types";

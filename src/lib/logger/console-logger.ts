import type { Logger, LogLevel } from "./types";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  constructor(
    private readonly name: string,
    private readonly minLevel: LogLevel
  ) {}

  child(childName: string): Logger {
    return new ConsoleLogger(`${this.name}:${childName}`, this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private emit(
    consoleFn: (...args: unknown[]) => void,
    level: string,
    msg: string,
    ctx?: Record<string, unknown>
  ) {
    const prefix = `[${this.name}] ${level}:`;
    ctx !== undefined ? consoleFn(prefix, msg, ctx) : consoleFn(prefix, msg);
  }

  debug(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("debug")) this.emit(console.log, "DEBUG", msg, ctx);
  }

  info(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("info")) this.emit(console.info, "INFO", msg, ctx);
  }

  warn(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("warn")) this.emit(console.warn, "WARN", msg, ctx);
  }

  error(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("error")) this.emit(console.error, "ERROR", msg, ctx);
  }
}

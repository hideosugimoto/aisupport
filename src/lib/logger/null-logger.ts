import type { Logger } from "./types";

export const nullLogger: Logger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => nullLogger,
});

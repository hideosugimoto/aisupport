import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseLogLevel } from "@/lib/logger";

describe("parseLogLevel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'debug' for valid debug input", () => {
    expect(parseLogLevel("debug")).toBe("debug");
  });

  it("returns 'info' for valid info input", () => {
    expect(parseLogLevel("info")).toBe("info");
  });

  it("returns 'warn' for valid warn input", () => {
    expect(parseLogLevel("warn")).toBe("warn");
  });

  it("returns 'error' for valid error input", () => {
    expect(parseLogLevel("error")).toBe("error");
  });

  it("falls back to 'info' for undefined", () => {
    expect(parseLogLevel(undefined)).toBe("info");
  });

  it("falls back to 'info' and warns for invalid string", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(parseLogLevel("verbose")).toBe("info");
    expect(spy).toHaveBeenCalledWith(
      '[logger] Invalid LOG_LEVEL="verbose", falling back to "info"'
    );
  });

  it("falls back to 'info' for uppercase variant", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(parseLogLevel("WARN")).toBe("info");
    expect(spy).toHaveBeenCalled();
  });

  it("does not warn when input is undefined", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    parseLogLevel(undefined);

    expect(spy).not.toHaveBeenCalled();
  });
});

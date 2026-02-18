import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsoleLogger } from "@/lib/logger/console-logger";

describe("ConsoleLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("level filtering", () => {
    it("debug level logs are suppressed in info mode", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.debug("should not appear");

      expect(spy).not.toHaveBeenCalled();
    });

    it("info level logs pass in info mode", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.info("should appear");

      expect(spy).toHaveBeenCalledWith("[test] INFO:", "should appear");
    });

    it("warn level logs pass in info mode", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.warn("warning");

      expect(spy).toHaveBeenCalledWith("[test] WARN:", "warning");
    });

    it("error level logs pass in info mode", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.error("error");

      expect(spy).toHaveBeenCalledWith("[test] ERROR:", "error");
    });

    it("all levels pass in debug mode", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "debug");

      logger.debug("d");
      logger.info("i");

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it("only error passes in error mode", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "error");

      logger.warn("should not appear");
      logger.error("should appear");

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("child()", () => {
    it("creates child logger with parent:child name format", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const parent = new ConsoleLogger("parent", "info");
      const child = parent.child("child");

      child.info("from child");

      expect(spy).toHaveBeenCalledWith(
        "[parent:child] INFO:",
        "from child"
      );
    });

    it("supports multi-level nesting", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const root = new ConsoleLogger("api", "info");
      const child = root.child("compass").child("suggester");

      child.info("nested");

      expect(spy).toHaveBeenCalledWith(
        "[api:compass:suggester] INFO:",
        "nested"
      );
    });
  });

  describe("context parameter", () => {
    it("passes context object when provided", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.info("with context", { userId: "abc", count: 3 });

      expect(spy).toHaveBeenCalledWith("[test] INFO:", "with context", {
        userId: "abc",
        count: 3,
      });
    });

    it("omits context argument when not provided", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.info("no context");

      expect(spy).toHaveBeenCalledWith("[test] INFO:", "no context");
    });
  });

  describe("console method mapping", () => {
    it("debug uses console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "debug");

      logger.debug("msg");

      expect(spy).toHaveBeenCalled();
    });

    it("info uses console.info", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.info("msg");

      expect(spy).toHaveBeenCalled();
    });

    it("warn uses console.warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.warn("msg");

      expect(spy).toHaveBeenCalled();
    });

    it("error uses console.error", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = new ConsoleLogger("test", "info");

      logger.error("msg");

      expect(spy).toHaveBeenCalled();
    });
  });
});

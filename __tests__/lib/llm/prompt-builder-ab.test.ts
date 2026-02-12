import { describe, it, expect } from "vitest";
import { loadTemplate } from "@/lib/llm/prompt-builder";
import { readFileSync } from "fs";
import { join } from "path";

describe("loadTemplate with version support", () => {
  it("should load default template when version is not specified", () => {
    const content = loadTemplate("task-decision", "system.md");
    expect(content).toBeDefined();
    expect(content).toContain("意思決定アシスタント");
  });

  it("should load v2 template when version is specified", () => {
    const content = loadTemplate("task-decision", "system.md", "v2");
    expect(content).toBeDefined();
    expect(content).toContain("構造化された意思決定アシスタント");
    expect(content).toContain("タスク評価マトリクス");
  });

  it("should load v2 user template when version is specified", () => {
    const content = loadTemplate("task-decision", "user-template.md", "v2");
    expect(content).toBeDefined();
    expect(content).toContain("評価基準");
    expect(content).toContain("時間適合");
  });

  it("should load v2 anxiety-mode template when version is specified", () => {
    const content = loadTemplate("task-decision", "anxiety-mode.md", "v2");
    expect(content).toBeDefined();
    expect(content).toContain("低エネルギーモード v2");
    expect(content).toContain("評価基準の調整");
  });

  it("should load shared template without version", () => {
    const content = loadTemplate("shared", "evaluation-axes.md");
    expect(content).toBeDefined();
  });

  it("should throw error for non-existent version", () => {
    expect(() => {
      loadTemplate("task-decision", "system.md", "v999");
    }).toThrow();
  });

  it("should throw error for non-existent template", () => {
    expect(() => {
      loadTemplate("task-decision", "non-existent.md");
    }).toThrow();
  });

  it("should cache templates correctly", () => {
    const content1 = loadTemplate("task-decision", "system.md", "v2");
    const content2 = loadTemplate("task-decision", "system.md", "v2");
    expect(content1).toBe(content2); // Same reference due to caching
  });

  it("should distinguish between default and v2 templates in cache", () => {
    const defaultContent = loadTemplate("task-decision", "system.md");
    const v2Content = loadTemplate("task-decision", "system.md", "v2");
    expect(defaultContent).not.toBe(v2Content);
    expect(defaultContent).toContain("冷静ロジカル型");
    expect(v2Content).toContain("構造化された");
  });

  it("should match file content exactly", () => {
    const PROMPTS_DIR = join(process.cwd(), "prompts");
    const expectedContent = readFileSync(
      join(PROMPTS_DIR, "task-decision/v2/system.md"),
      "utf-8"
    );
    const loadedContent = loadTemplate("task-decision", "system.md", "v2");
    expect(loadedContent).toBe(expectedContent);
  });
});

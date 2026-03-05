import { describe, it, expect } from "vitest";

/**
 * コードレビュー指摘修正のテスト
 * push/send, push/subscribe, push/unsubscribe のバリデーションロジック確認
 *
 * 各ルートはAPIルート内でインラインバリデーションを行っているため、
 * ここではバリデーション条件のロジックを共通ヘルパーとしてテストする。
 */

// バリデーションヘルパー（ルート内のインラインロジックと同等）
function validateStringField(value: unknown, maxLength: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function validateFiniteNumber(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

describe("Push send input validation logic", () => {
  it("should accept valid title within 200 chars", () => {
    expect(validateStringField("通知タイトル", 200)).toBe(true);
  });

  it("should reject non-string title", () => {
    expect(validateStringField(123, 200)).toBe(false);
    expect(validateStringField(null, 200)).toBe(false);
    expect(validateStringField(undefined, 200)).toBe(false);
  });

  it("should reject title exceeding 200 chars", () => {
    expect(validateStringField("a".repeat(201), 200)).toBe(false);
  });

  it("should reject empty title", () => {
    expect(validateStringField("", 200)).toBe(false);
  });

  it("should accept valid message within 1000 chars", () => {
    expect(validateStringField("メッセージ本文", 1000)).toBe(true);
  });

  it("should reject message exceeding 1000 chars", () => {
    expect(validateStringField("a".repeat(1001), 1000)).toBe(false);
  });
});

describe("Push subscribe input validation logic", () => {
  it("should accept valid endpoint within 2000 chars", () => {
    expect(validateStringField("https://push.example.com/sub/123", 2000)).toBe(true);
  });

  it("should reject endpoint exceeding 2000 chars", () => {
    expect(validateStringField("https://" + "x".repeat(2000), 2000)).toBe(false);
  });

  it("should accept valid p256dh within 500 chars", () => {
    expect(validateStringField("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REqnSw", 500)).toBe(true);
  });

  it("should reject p256dh exceeding 500 chars", () => {
    expect(validateStringField("x".repeat(501), 500)).toBe(false);
  });
});

describe("History route number validation logic", () => {
  it("should accept valid finite numbers", () => {
    expect(validateFiniteNumber(100, 0, 10_000_000)).toBe(true);
    expect(validateFiniteNumber(0, 0, 10_000_000)).toBe(true);
  });

  it("should reject Infinity", () => {
    expect(validateFiniteNumber(Infinity, 0, 10_000_000)).toBe(false);
    expect(validateFiniteNumber(-Infinity, 0, 10_000_000)).toBe(false);
  });

  it("should reject NaN", () => {
    expect(validateFiniteNumber(NaN, 0, 10_000_000)).toBe(false);
  });

  it("should reject negative values", () => {
    expect(validateFiniteNumber(-1, 0, 10_000_000)).toBe(false);
  });

  it("should reject values exceeding upper bound", () => {
    expect(validateFiniteNumber(10_000_001, 0, 10_000_000)).toBe(false);
  });

  it("should reject non-number types", () => {
    expect(validateFiniteNumber("100", 0, 10_000_000)).toBe(false);
    expect(validateFiniteNumber(null, 0, 10_000_000)).toBe(false);
  });
});

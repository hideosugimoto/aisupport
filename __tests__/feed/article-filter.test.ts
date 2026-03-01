import { describe, it, expect } from "vitest";
import { filterByKeywordRelevance } from "@/lib/feed/article-filter";
import type { FeedArticleData } from "@/lib/feed/types";

function makeArticle(
  overrides: Partial<FeedArticleData> = {}
): FeedArticleData {
  return {
    title: "デフォルトタイトル",
    url: "https://example.com/article",
    source: "google_news",
    category: "news",
    snippet: "デフォルトスニペット",
    publishedAt: new Date("2026-03-01"),
    keyword: "テスト",
    ...overrides,
  };
}

describe("filterByKeywordRelevance", () => {
  it("キーワードにマッチする記事は通過する", () => {
    const articles = [
      makeArticle({ title: "TypeScript 5.0 リリース", keyword: "TypeScript" }),
      makeArticle({ title: "React最新動向", keyword: "React" }),
    ];
    const result = filterByKeywordRelevance(articles, ["TypeScript"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("TypeScript 5.0 リリース");
  });

  it("snippetにキーワードが含まれる記事も通過する", () => {
    const articles = [
      makeArticle({
        title: "プログラミング最新情報",
        snippet: "TypeScriptの新機能について",
        keyword: "TypeScript",
      }),
    ];
    const result = filterByKeywordRelevance(articles, ["TypeScript"]);
    expect(result).toHaveLength(1);
  });

  it("キーワードにマッチしない記事はフィルタされる", () => {
    const articles = [
      makeArticle({ title: "交通事故が発生", snippet: "高速道路で衝突", keyword: "AI" }),
    ];
    const result = filterByKeywordRelevance(articles, ["AI 人工知能"]);
    expect(result).toHaveLength(0);
  });

  it("大文字小文字を区別しない", () => {
    const articles = [
      makeArticle({ title: "typescript is great", keyword: "TypeScript" }),
    ];
    const result = filterByKeywordRelevance(articles, ["TypeScript"]);
    expect(result).toHaveLength(1);
  });

  it("複数キーワードのうち1単語でもヒットすれば通過する", () => {
    const articles = [
      makeArticle({ title: "機械学習の進化", keyword: "AI 機械学習" }),
    ];
    const result = filterByKeywordRelevance(articles, ["AI 機械学習"]);
    expect(result).toHaveLength(1);
  });

  it("__category_ 記事はフィルタをスキップする", () => {
    const articles = [
      makeArticle({
        title: "全く関係ない事故ニュース",
        snippet: "無関係",
        keyword: "__category_yahoo_news_jp",
      }),
    ];
    const result = filterByKeywordRelevance(articles, ["TypeScript"]);
    expect(result).toHaveLength(1);
  });

  it("空の記事配列は空配列を返す", () => {
    const result = filterByKeywordRelevance([], ["TypeScript"]);
    expect(result).toEqual([]);
  });

  it("空のキーワード配列はすべての記事を通過させる", () => {
    const articles = [makeArticle(), makeArticle()];
    const result = filterByKeywordRelevance(articles, []);
    expect(result).toHaveLength(2);
  });

  it("1文字のトークンは無視される", () => {
    const articles = [
      makeArticle({ title: "A new approach", keyword: "A" }),
    ];
    // "A" は1文字なので extractTokens で除外される → tokens が空 → 全件通過
    const result = filterByKeywordRelevance(articles, ["A"]);
    expect(result).toHaveLength(1);
  });

  it("スペース区切りの複合キーワードが個別トークンとしてマッチする", () => {
    const articles = [
      makeArticle({ title: "最新のReactフレームワーク", keyword: "React" }),
      makeArticle({ title: "Next.js入門ガイド", keyword: "Next.js" }),
    ];
    const result = filterByKeywordRelevance(articles, ["React Next.js"]);
    // "react" と "next.js" がそれぞれマッチ
    expect(result).toHaveLength(2);
  });
});

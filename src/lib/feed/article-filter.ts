import type { FeedArticleData } from "./types";

/**
 * キーワード検索結果に対する簡易キーワードマッチフィルタ。
 * タイトル+snippetにキーワードの一部が含まれるかチェックし、
 * 1単語でもヒットすれば通過させる（緩めに設定して取りこぼし防止）。
 *
 * カテゴリフィード（__category_*）はスキップ（別途LLMフィルタで処理）。
 */
export function filterByKeywordRelevance(
  articles: FeedArticleData[],
  keywords: string[]
): FeedArticleData[] {
  if (keywords.length === 0) return articles;

  const tokens = extractTokens(keywords);
  if (tokens.length === 0) return articles;

  return articles.filter((article) => {
    // カテゴリフィードはスキップ
    if (article.keyword.startsWith("__category_")) return true;

    const text = `${article.title} ${article.snippet}`.toLowerCase();
    return tokens.some((token) => text.includes(token));
  });
}

/**
 * キーワード群をスペース区切りで形態素に分割し、
 * 検索用の小文字トークン配列を返す。
 * 1文字のトークンはノイズになるため除外。
 */
function extractTokens(keywords: string[]): string[] {
  const tokenSet = new Set<string>();
  for (const kw of keywords) {
    for (const part of kw.split(/\s+/)) {
      const trimmed = part.trim().toLowerCase();
      if (trimmed.length >= 2) {
        tokenSet.add(trimmed);
      }
    }
  }
  return [...tokenSet];
}

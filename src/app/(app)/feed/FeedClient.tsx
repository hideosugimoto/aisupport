"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { SOURCE_LABELS, type FeedSource } from "@/lib/feed/types";

interface FeedArticle {
  id: number;
  title: string;
  url: string;
  source: string;
  category: string;
  snippet: string;
  publishedAt: string;
  keyword: string;
  imageUrl: string | null;
  isRead: boolean;
}

interface FeedKeyword {
  id: number;
  keyword: string;
}

interface FeedResponse {
  articles: FeedArticle[];
  pagination: { page: number; pageSize: number; total: number };
}

interface KeywordsResponse {
  keywords: FeedKeyword[];
}

type TabType = "news" | "blog";
type KeywordMode = "wide" | "standard" | "deep";

const KEYWORD_MODES: { value: KeywordMode; label: string }[] = [
  { value: "wide", label: "ワイド（広く浅く）" },
  { value: "standard", label: "スタンダード" },
  { value: "deep", label: "ディープ（深く狭く）" },
];

function stripHtml(html: string): string {
  // 1回目: HTMLエンティティ(&lt; &gt; &amp;等)をデコード
  const decoded = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  // 2回目: デコード後の実際のHTMLタグを除去してテキストだけ取得
  const text = new DOMParser().parseFromString(decoded, "text/html").body.textContent ?? "";
  return text.replace(/\u00A0/g, " ");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function FeedClient() {
  const [activeTab, setActiveTab] = useState<TabType>("news");
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [keywords, setKeywords] = useState<FeedKeyword[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const modeButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const fetchKeywords = useCallback(async () => {
    setKeywordsLoading(true);
    setKeywordsError(null);
    try {
      const res = await fetch("/api/feed/keywords");
      if (!res.ok) {
        const data = await res.json();
        setKeywordsError(data.error ?? "キーワードの取得に失敗しました");
        return;
      }
      const data: KeywordsResponse = await res.json();
      setKeywords(data.keywords);
    } catch {
      setKeywordsError("ネットワークエラーが発生しました");
    } finally {
      setKeywordsLoading(false);
    }
  }, []);

  const fetchArticles = useCallback(
    async (currentPage: number, tab: TabType, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const category = tab === "news" ? "news" : "blog";
        const res = await fetch(
          `/api/feed?category=${category}&page=${currentPage}`
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "記事の取得に失敗しました");
          return;
        }
        const data: FeedResponse = await res.json();
        if (replace) {
          setArticles(data.articles);
        } else {
          setArticles((prev) => [...prev, ...data.articles]);
        }
        setTotal(data.pagination.total);
      } catch {
        setError("ネットワークエラーが発生しました");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    setPage(1);
    setArticles([]);
    fetchArticles(1, activeTab, true);
  }, [activeTab, fetchArticles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/feed/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "リフレッシュに失敗しました");
        return;
      }
      setPage(1);
      await fetchArticles(1, activeTab, true);
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateKeywords = async (mode: KeywordMode = "standard") => {
    setGenerating(true);
    setKeywordsError(null);
    setShowModeMenu(false);
    try {
      const res = await fetch("/api/feed/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json();
        setKeywordsError(data.error ?? "キーワードの生成に失敗しました");
        return;
      }
      await fetchKeywords();
    } catch {
      setKeywordsError("ネットワークエラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  // ドロップダウン外クリックで閉じる + Escapeキー
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowModeMenu(false);
        modeButtonRef.current?.focus();
      }
    }
    if (showModeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      // メニュー展開時に最初の項目にフォーカス
      requestAnimationFrame(() => menuItemRefs.current[0]?.focus());
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showModeMenu]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchArticles(nextPage, activeTab, false);
  };

  const hasMore = articles.length < total;

  return (
    <div>
      {/* タブ + リフレッシュボタン */}
      <div className="flex items-center justify-between mb-4">
        <div
          role="tablist"
          aria-label="フィードカテゴリ"
          className="flex gap-0 border-b border-zinc-200 dark:border-zinc-800"
        >
          <button
            role="tab"
            id="tab-news"
            aria-selected={activeTab === "news"}
            aria-controls="tabpanel-news"
            tabIndex={activeTab === "news" ? 0 : -1}
            onClick={() => setActiveTab("news")}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                setActiveTab("blog");
                document.getElementById("tab-blog")?.focus();
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "news"
                ? "border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            ニュース
          </button>
          <button
            role="tab"
            id="tab-blog"
            aria-selected={activeTab === "blog"}
            aria-controls="tabpanel-blog"
            tabIndex={activeTab === "blog" ? 0 : -1}
            onClick={() => setActiveTab("blog")}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                setActiveTab("news");
                document.getElementById("tab-news")?.focus();
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "blog"
                ? "border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            ブログ・コラム
          </button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? "取得中..." : "最新を取得"}
        </button>
      </div>

      {/* キーワードチップ */}
      {keywordsLoading ? (
        <div className="mb-4 text-sm text-zinc-400 dark:text-zinc-500">
          キーワードを読み込み中...
        </div>
      ) : keywords.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {keywords.map((kw) => (
            <span
              key={kw.id}
              className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400"
            >
              #{kw.keyword}
            </span>
          ))}
          <div ref={modeMenuRef} className="relative inline-block">
            <button
              ref={modeButtonRef}
              onClick={() => setShowModeMenu((prev) => !prev)}
              disabled={generating}
              aria-label="キーワードを再生成"
              aria-haspopup="menu"
              aria-expanded={showModeMenu}
              className="inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "生成中..." : "再生成 ▾"}
            </button>
            {showModeMenu && (
              <div
                role="menu"
                aria-label="キーワード生成モード"
                className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-10"
              >
                {KEYWORD_MODES.map((m, i) => (
                  <button
                    key={m.value}
                    ref={(el) => { menuItemRefs.current[i] = el; }}
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => handleGenerateKeywords(m.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        menuItemRefs.current[(i + 1) % KEYWORD_MODES.length]?.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        menuItemRefs.current[(i - 1 + KEYWORD_MODES.length) % KEYWORD_MODES.length]?.focus();
                      }
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:outline-none first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* キーワードエラー */}
      {keywordsError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {keywordsError}
        </div>
      )}

      {/* 記事エラー */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* キーワード未生成の案内 */}
      {!keywordsLoading && keywords.length === 0 && !keywordsError && (
        <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            羅針盤データからキーワードを生成して
            <br />
            パーソナライズされたニュースを受け取ろう
          </p>
          <button
            onClick={() => handleGenerateKeywords("standard")}
            disabled={generating}
            className="rounded-lg px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "生成中..." : "キーワードを生成する"}
          </button>
        </div>
      )}

      {/* 記事一覧 */}
      <div
        aria-live="polite"
        aria-busy={loading}
        role="tabpanel"
        id={activeTab === "news" ? "tabpanel-news" : "tabpanel-blog"}
        aria-labelledby={activeTab === "news" ? "tab-news" : "tab-blog"}
      >
        {loading && articles.length === 0 ? (
          <div role="status" className="text-sm text-zinc-400 dark:text-zinc-500">
            記事を読み込み中...
          </div>
        ) : articles.length > 0 ? (
          <div className="flex flex-col gap-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  {article.imageUrl && (
                    <div className="relative shrink-0 w-24 h-16 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <Image
                        src={article.imageUrl}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 leading-snug hover:text-blue-600 dark:hover:text-blue-400">
                      {article.title}
                      <span className="sr-only">（外部サイト、新しいタブで開きます）</span>
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      {SOURCE_LABELS[article.source as FeedSource] ?? article.source} — {formatDate(article.publishedAt)}
                    </p>
                    {article.snippet && (() => {
                      const text = stripHtml(article.snippet).trim();
                      // 記号・空白を除去して比較（"Title - Source" vs "Title  Source" 対策）
                      const norm = (s: string) => s.replace(/[\s\-\u2010-\u2015\u2212\uFF0D\u30FB·,.、。]/g, "");
                      const titleNorm = norm(article.title);
                      const snippetNorm = norm(text);
                      if (!text || titleNorm.includes(snippetNorm) || snippetNorm.includes(titleNorm)) return null;
                      return (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 line-clamp-2">
                          {text}
                        </p>
                      );
                    })()}
                    {!article.keyword.startsWith("__category_") && (
                      <span
                        aria-label={`キーワード: ${article.keyword}`}
                        className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400"
                      >
                        #{article.keyword}
                      </span>
                    )}
                    {article.keyword.startsWith("__category_") && (
                      <span
                        aria-label="カテゴリ記事"
                        className="inline-flex items-center rounded-full bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400 dark:text-zinc-500"
                      >
                        {SOURCE_LABELS[article.source as FeedSource] ?? article.source}
                      </span>
                    )}
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : !loading && keywords.length > 0 ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              記事がありません。「最新を取得」ボタンで記事を取得してください。
            </p>
          </div>
        ) : null}

        {/* もっと読む */}
        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLoadMore}
              className="rounded-lg px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              もっと読み込む
            </button>
          </div>
        )}

        {loading && articles.length > 0 && (
          <div role="status" className="mt-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
            読み込み中...
          </div>
        )}
      </div>
    </div>
  );
}

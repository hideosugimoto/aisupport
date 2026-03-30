/** Compass の検索ヒット1件 */
export interface CompassMatch {
  title: string;
  similarity: number;
}

/** Compass 参照結果のメタ情報。Decide / Compare / StreamingMeta で共通利用 */
export interface CompassRelevance {
  hasCompass: boolean;
  topMatches: CompassMatch[];
}

/**
 * CompassItem の metadata フィールドに格納する構造化データ。
 * 現在は自由入力ベースだが、将来の構造化 Compass 対応に向けた拡張点。
 */
export interface CompassMetadata {
  /** 大切にしている価値観 (例: "自由", "誠実さ") */
  values?: string[];
  /** 避けたい価値観・行動 (例: "他人依存", "完璧主義") */
  antiValues?: string[];
  /** 関連領域 (例: "キャリア", "健康", "家族") */
  domains?: string[];
  /** 超えてはいけない境界線 (例: "週60時間以上は働かない") */
  boundaries?: string[];
  /** 根本的な欲求 (例: "経済的自由", "創造的な仕事") */
  coreDesires?: string[];
}

/**
 * metadata JSON 文字列をパースして CompassMetadata を返す。
 * パース失敗時は undefined を返す。
 */
export function parseCompassMetadata(raw: string | null | undefined): CompassMetadata | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as CompassMetadata;
  } catch {
    return undefined;
  }
}

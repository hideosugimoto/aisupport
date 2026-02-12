import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";

/**
 * E2E Mock Client for Playwright tests
 * Returns appropriate responses based on request content
 */
export class E2EMockClient implements LLMClient {
  private callCount = 0;

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.callCount++;

    // Check if this is a breakdown request
    const lastMessage = request.messages[request.messages.length - 1];
    const isBreakdown =
      lastMessage?.content.includes("サブタスク") ||
      lastMessage?.content.includes("分解") ||
      lastMessage?.content.includes("ステップ");

    const content = isBreakdown
      ? this.getBreakdownResponse()
      : this.getDecisionResponse();

    return {
      content,
      usage: {
        inputTokens: 100,
        outputTokens: 150,
        totalTokens: 250,
      },
      requestId: `e2e-mock-${this.callCount}`,
    };
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.callCount++;

    const response = await this.chat(request);
    const words = response.content.split(" ");

    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      yield {
        content: (i > 0 ? " " : "") + words[i],
        done: isLast,
        ...(isLast
          ? {
              usage: {
                inputTokens: 100,
                outputTokens: 150,
                totalTokens: 250,
              },
            }
          : {}),
      };
    }
  }

  extractUsage(_rawResponse: unknown): TokenUsage {
    return {
      inputTokens: 100,
      outputTokens: 150,
      totalTokens: 250,
    };
  }

  private getDecisionResponse(): string {
    return `## テスト判定結果

**判定**: ✅ 実施推奨

### 理由
- テストタスクとして妥当な内容です
- 明確な目標が設定されています
- 実装可能な範囲です

### 懸念点
- 特になし

### 今日の最適タスク
テストタスクの実装

### 推奨アクション
1. 実装を進めてください
2. テストを追加してください

これはE2Eテスト用のモックレスポンスです。`;
  }

  private getBreakdownResponse(): string {
    return `## サブタスク分解結果

1. 要件定義
   - 概要: 機能要件の洗い出し
   - 優先度: 高

2. 設計
   - 概要: システム設計とアーキテクチャ決定
   - 優先度: 高

3. 実装
   - 概要: コーディング作業
   - 優先度: 中

4. テスト
   - 概要: ユニットテスト・E2Eテスト作成
   - 優先度: 中

この分解結果はE2Eテスト用のモックレスポンスです。`;
  }
}

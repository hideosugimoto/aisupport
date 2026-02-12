export interface UsageLogEntry {
  id?: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  feature: string;
  requestId?: string;
  metadata?: string;
  createdAt?: Date;
}

export interface ProviderCostSummary {
  provider: string;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface UsageLogRepository {
  save(log: UsageLogEntry): Promise<void>;
  findByMonth(year: number, month: number): Promise<UsageLogEntry[]>;
  findByDateRange(from: Date, to: Date): Promise<UsageLogEntry[]>;
  aggregateByProvider(
    year: number,
    month: number
  ): Promise<ProviderCostSummary[]>;
}

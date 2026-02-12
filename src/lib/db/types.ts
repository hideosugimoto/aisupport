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

export interface TaskDecisionEntry {
  tasksInput: string; // JSON string of task array
  energyLevel: number;
  availableTime: number;
  provider: string;
  model: string;
  result: string;
}

export interface TaskDecisionRecord extends TaskDecisionEntry {
  id: number;
  createdAt: Date;
}

export interface TaskDecisionRepository {
  save(entry: TaskDecisionEntry): Promise<void>;
  findAll(limit: number, offset: number): Promise<TaskDecisionRecord[]>;
  findByDateRange(from: Date, to: Date): Promise<TaskDecisionRecord[]>;
  search(
    keyword: string,
    limit: number,
    offset: number
  ): Promise<TaskDecisionRecord[]>;
  count(): Promise<number>;
  countBySearch(keyword: string): Promise<number>;
}

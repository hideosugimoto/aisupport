export interface UsageLogEntry {
  id?: number;
  userId?: string;
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
  findByMonth(userId: string, year: number, month: number): Promise<UsageLogEntry[]>;
  findByDateRange(userId: string, from: Date, to: Date): Promise<UsageLogEntry[]>;
  aggregateByProvider(
    userId: string,
    year: number,
    month: number
  ): Promise<ProviderCostSummary[]>;
}

export interface TaskDecisionEntry {
  userId?: string;
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
  findAll(userId: string, limit: number, offset: number): Promise<TaskDecisionRecord[]>;
  findByDateRange(userId: string, from: Date, to: Date): Promise<TaskDecisionRecord[]>;
  search(
    userId: string,
    keyword: string,
    limit: number,
    offset: number
  ): Promise<TaskDecisionRecord[]>;
  count(userId: string): Promise<number>;
  countBySearch(userId: string, keyword: string): Promise<number>;
}

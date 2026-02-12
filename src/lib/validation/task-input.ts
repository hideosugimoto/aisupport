import featuresConfig from "../../../config/features.json";

const MAX_TASKS = 10;
const MAX_TASK_LENGTH = 200;

export interface TaskInput {
  tasks: string[];
  availableTime: number;
  energyLevel: number;
  provider: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTaskInput(input: TaskInput): ValidationResult {
  const errors: string[] = [];

  // タスク候補: 1件以上必須・各タスク1文字以上
  if (
    input.tasks.length === 0 ||
    input.tasks.some((t) => t.trim().length === 0)
  ) {
    errors.push("タスクを1つ以上入力してください");
  }

  // タスク数上限
  if (input.tasks.length > MAX_TASKS) {
    errors.push(`タスクは${MAX_TASKS}件以内にしてください`);
  }

  // 各タスク文字数上限
  if (input.tasks.some((t) => t.length > MAX_TASK_LENGTH)) {
    errors.push(`各タスクは${MAX_TASK_LENGTH}文字以内にしてください`);
  }

  // 利用可能時間: 1〜1440の整数
  if (
    !Number.isInteger(input.availableTime) ||
    input.availableTime < 1 ||
    input.availableTime > 1440
  ) {
    errors.push("利用可能時間を正しく入力してください");
  }

  // エネルギー状態: 1〜5の整数
  if (
    !Number.isInteger(input.energyLevel) ||
    input.energyLevel < 1 ||
    input.energyLevel > 5
  ) {
    errors.push("1〜5の範囲で選択してください");
  }

  // エンジン選択: enabled_providersに含まれること
  if (!featuresConfig.enabled_providers.includes(input.provider)) {
    errors.push("エンジンを選択してください");
  }

  return { valid: errors.length === 0, errors };
}

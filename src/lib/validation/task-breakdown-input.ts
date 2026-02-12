import featuresConfig from "../../../config/features.json";

const MAX_TASK_LENGTH = 200;

export interface BreakdownInput {
  task: string;
  availableTime: number;
  energyLevel: number;
  provider: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBreakdownInput(
  input: BreakdownInput
): ValidationResult {
  const errors: string[] = [];

  if (input.task.trim().length === 0) {
    errors.push("タスクを入力してください");
  }

  if (input.task.length > MAX_TASK_LENGTH) {
    errors.push(`タスクは${MAX_TASK_LENGTH}文字以内にしてください`);
  }

  if (
    !Number.isInteger(input.availableTime) ||
    input.availableTime < 1 ||
    input.availableTime > 1440
  ) {
    errors.push("利用可能時間を正しく入力してください");
  }

  if (
    !Number.isInteger(input.energyLevel) ||
    input.energyLevel < 1 ||
    input.energyLevel > 5
  ) {
    errors.push("1〜5の範囲で選択してください");
  }

  if (!featuresConfig.enabled_providers.includes(input.provider)) {
    errors.push("エンジンを選択してください");
  }

  return { valid: errors.length === 0, errors };
}

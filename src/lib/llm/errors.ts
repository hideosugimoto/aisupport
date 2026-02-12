export type LLMErrorCode =
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    public provider: string,
    public retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "LLMError";
  }
}

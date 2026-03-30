import type { CompassSuggestion } from "../compass/compass-suggester";
import type { CompassRelevance } from "../compass/types";
import type { DecisionContextHints } from "../decision/task-decision-engine";

export type { CompassRelevance };
export type ContextHints = DecisionContextHints;

export type ChatStep =
  | "compass-setup"
  | "tasks"
  | "time"
  | "energy"
  | "confirm"
  | "loading"
  | "result";

export interface CompassItem {
  id: number;
  title: string;
}

export type UIState = "idle" | "loading" | "streaming" | "completed" | "error";

export interface State {
  status: UIState;
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
  compassRelevance?: CompassRelevance;
  contextHints?: ContextHints;
  breakdownStatus: "idle" | "loading" | "streaming" | "completed" | "error";
  breakdownContent: string;
  breakdownInputTokens: number;
  breakdownOutputTokens: number;
  breakdownError: string | null;
}

export type Action =
  | { type: "START_LOADING" }
  | { type: "START_STREAMING" }
  | { type: "APPEND_CONTENT"; content: string }
  | {
      type: "COMPLETE";
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      isAnxietyMode: boolean;
    }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "SET_COMPASS"; compassRelevance: CompassRelevance }
  | { type: "SET_CONTEXT_HINTS"; contextHints: ContextHints }
  | { type: "START_BREAKDOWN" }
  | { type: "START_BREAKDOWN_STREAMING" }
  | { type: "APPEND_BREAKDOWN_CONTENT"; content: string }
  | { type: "COMPLETE_BREAKDOWN"; inputTokens: number; outputTokens: number }
  | { type: "BREAKDOWN_ERROR"; error: string };

export const initialState: State = {
  status: "idle",
  content: "",
  isAnxietyMode: false,
  provider: "",
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  error: null,
  breakdownStatus: "idle",
  breakdownContent: "",
  breakdownInputTokens: 0,
  breakdownOutputTokens: 0,
  breakdownError: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_LOADING":
      return { ...initialState, status: "loading" };
    case "START_STREAMING":
      return { ...state, status: "streaming" };
    case "APPEND_CONTENT":
      return { ...state, content: state.content + action.content };
    case "COMPLETE":
      return {
        ...state,
        status: "completed",
        content: state.content || "",
        provider: action.provider,
        model: action.model,
        inputTokens: action.inputTokens,
        outputTokens: action.outputTokens,
        isAnxietyMode: action.isAnxietyMode,
      };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return initialState;
    case "SET_COMPASS":
      return { ...state, compassRelevance: action.compassRelevance };
    case "SET_CONTEXT_HINTS":
      return { ...state, contextHints: action.contextHints };
    case "START_BREAKDOWN":
      return {
        ...state,
        breakdownStatus: "loading",
        breakdownContent: "",
        breakdownInputTokens: 0,
        breakdownOutputTokens: 0,
        breakdownError: null,
      };
    case "START_BREAKDOWN_STREAMING":
      return { ...state, breakdownStatus: "streaming" };
    case "APPEND_BREAKDOWN_CONTENT":
      return {
        ...state,
        breakdownContent: state.breakdownContent + action.content,
      };
    case "COMPLETE_BREAKDOWN":
      return {
        ...state,
        breakdownStatus: "completed",
        breakdownInputTokens: action.inputTokens,
        breakdownOutputTokens: action.outputTokens,
      };
    case "BREAKDOWN_ERROR":
      return {
        ...state,
        breakdownStatus: "error",
        breakdownError: action.error,
      };
    default:
      return state;
  }
}

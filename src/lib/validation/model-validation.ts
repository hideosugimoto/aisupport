import featuresConfig from "../../../config/features.json";

/**
 * 指定プロバイダーで許可されたモデルかを検証する。
 * APIルートのモデルホワイトリスト検証で共通使用する。
 */
export function isAllowedModel(provider: string, model: string): boolean {
  const allowed =
    featuresConfig.available_models[
      provider as keyof typeof featuresConfig.available_models
    ] ?? [];
  return allowed.includes(model);
}

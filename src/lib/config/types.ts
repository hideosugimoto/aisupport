import featuresConfig from "../../../config/features.json";

export type FeaturesConfig = typeof featuresConfig;
export type ProviderKey = keyof typeof featuresConfig.default_model;

export function getDefaultModel(provider: string): string {
  const model = featuresConfig.default_model[provider as ProviderKey];
  if (!model) {
    throw new Error(
      `Unknown provider: ${provider}. Valid providers: ${Object.keys(featuresConfig.default_model).join(", ")}`
    );
  }
  return model;
}

export function getAvailableModels(provider: string): string[] {
  return (
    featuresConfig.available_models[
      provider as keyof typeof featuresConfig.available_models
    ] ?? []
  );
}

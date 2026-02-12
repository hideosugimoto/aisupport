import featuresConfig from "../../../config/features.json";

export type FeaturesConfig = typeof featuresConfig;
export type ProviderKey = keyof typeof featuresConfig.default_model;

export function getDefaultModel(provider: string): string {
  return featuresConfig.default_model[provider as ProviderKey];
}

export function getAvailableModels(provider: string): string[] {
  return (
    featuresConfig.available_models[
      provider as keyof typeof featuresConfig.available_models
    ] ?? []
  );
}

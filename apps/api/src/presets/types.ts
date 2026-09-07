/**
 * Preset domain types. The preset layer (built-in catalogs, upstream refresh, cache
 * merge) is self-contained: these shapes are owned here and re-exported by the adapter
 * layer, never the other way around.
 */

export interface ModelsConfiguration {
  providers: Record<string, ProviderConfiguration>;
}

export interface ProviderConfiguration {
  baseUrl?: string;
  api?: "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";
  apiKey?: string;
  oauth?: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  models?: ModelConfiguration[];
  modelOverrides?: Record<string, Record<string, unknown>>;
  compat?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ModelConfiguration {
  id: string;
  name?: string;
  api?: ProviderConfiguration["api"];
  reasoning?: boolean;
  input?: Array<"text" | "image">;
  contextWindow?: number;
  maxTokens?: number;
  cost?: Record<string, unknown>;
  compat?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * A starting point for a provider, not a source of truth. Connection fields are the useful
 * part; models and pricing drift, so the UI tells the user to verify what it imported.
 */
export interface ProviderPreset {
  id: string;
  label: string;
  description: string;
  docsUrl?: string;
  /** Connection defaults. Models are kept separate so they can be imported one at a time. */
  provider: Omit<ProviderConfiguration, "models">;
  models: ModelConfiguration[];
}

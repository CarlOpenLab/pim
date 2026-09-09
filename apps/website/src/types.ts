export type AgentId = "pi" | "omp";
export type ConfigScope = "global" | "project";
export type ViewId = "settings" | "providers" | "roles" | "modelRoles" | "model" | "persona";
export interface OmpAvailableModel {
  provider: string;
  id: string;
  selector: string;
  name: string;
  reasoning: boolean;
  thinking: string[];
  input: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: ModelCost;
}

export interface OmpRolePreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: string;
  accent: string;
}

/** Sentinel the API sends in place of a literal secret it found on disk. */
export const REDACTED = "__PIM_REDACTED__";

export interface Diagnostic {
  level: "error" | "warning";
  file: string;
  message: string;
}

export interface AgentSummary {
  id: AgentId;
  name: string;
  description: string;
  available: boolean;
  version: string | null;
  configDir: string;
  capabilities: string[];
}

export interface ConfigDocument<T> {
  path: string;
  exists: boolean;
  data: T;
  diagnostics: Diagnostic[];
  modifiedAt: string | null;
}

export interface CredentialStatus {
  provider: string;
  type: string;
  configured: boolean;
  environmentKeys: string[];
}

export interface SecretReference {
  name: string;
  present: boolean;
  usedBy: string[];
}

export type ProviderApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai";

/** US dollars per million tokens, matching what Pi reads out of models.json. */
export interface ModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  [key: string]: unknown;
}

export interface ModelConfiguration {
  id: string;
  name?: string;
  api?: ProviderApi;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
  contextWindow?: number;
  maxTokens?: number;
  cost?: ModelCost;
  compat?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProviderConfiguration {
  baseUrl?: string;
  api?: ProviderApi;
  apiKey?: string;
  authHeader?: boolean;
  models?: ModelConfiguration[];
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export interface ProviderPreset {
  id: string;
  label: string;
  description: string;
  docsUrl?: string;
  provider: Omit<ProviderConfiguration, "models">;
  models: ModelConfiguration[];
}

export interface ModelsConfiguration {
  providers: Record<string, ProviderConfiguration>;
}

export interface AgentConfiguration {
  agent: AgentSummary;
  scope: ConfigScope;
  projectPath: string;
  settings: ConfigDocument<Record<string, unknown>>;
  models: ConfigDocument<ModelsConfiguration>;
  credentials: CredentialStatus[];
  secretRefs: SecretReference[];
}

export interface SaveResult {
  path: string;
  backupPath: string | null;
  savedAt: string;
  /** Keys the write moved into the agent runtime's own config store (e.g. omp config). */
  migratedKeys?: string[];
}

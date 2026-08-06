export type AgentId = "pi" | "omp";
export type ConfigScope = "global" | "project";
export type ViewId = "settings" | "providers" | "credentials" | "resources";

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

export interface ModelConfiguration {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
  contextWindow?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface ProviderConfiguration {
  baseUrl?: string;
  api?: "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";
  apiKey?: string;
  authHeader?: boolean;
  models?: ModelConfiguration[];
  headers?: Record<string, string>;
  [key: string]: unknown;
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
}

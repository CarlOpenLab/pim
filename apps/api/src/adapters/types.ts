export type AgentId = "pi" | "omp";
export type ConfigScope = "global" | "project";

export interface Diagnostic {
  level: "error" | "warning";
  file: string;
  message: string;
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

export interface AgentSummary {
  id: AgentId;
  name: string;
  description: string;
  available: boolean;
  version: string | null;
  configDir: string;
  capabilities: string[];
}

export interface AgentConfiguration {
  agent: AgentSummary;
  scope: ConfigScope;
  projectPath: string;
  settings: ConfigDocument<Record<string, unknown>>;
  models: ConfigDocument<ModelsConfiguration>;
  credentials: CredentialStatus[];
}

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

export interface SaveResult {
  path: string;
  backupPath: string | null;
  savedAt: string;
}

export interface AgentAdapter {
  readonly id: AgentId;
  inspect(): Promise<AgentSummary>;
  readConfiguration(scope: ConfigScope, projectPath: string): Promise<AgentConfiguration>;
  writeSettings(
    scope: ConfigScope,
    projectPath: string,
    value: Record<string, unknown>,
  ): Promise<SaveResult>;
  writeModels(value: ModelsConfiguration): Promise<SaveResult>;
}

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

/**
 * A `$VAR_NAME` reference found in a configuration file. PIM never reads or stores the
 * value — `present` only reports whether the variable exists in the PIM process environment.
 */
export interface SecretReference {
  name: string;
  present: boolean;
  usedBy: string[];
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
  secretRefs: SecretReference[];
}

import type { ModelsConfiguration } from "../presets/types.js";

// The preset layer owns the model/provider configuration shapes it ships as templates.
export type {
  ModelConfiguration,
  ModelsConfiguration,
  ProviderConfiguration,
  ProviderPreset,
} from "../presets/types.js";

export interface SaveResult {
  path: string;
  backupPath: string | null;
  savedAt: string;
  /**
   * Keys the write moved out of the file into the agent runtime's own config store
   * (OMP persists `modelRoles` etc. via `omp config set`). Reported so the UI can
   * tell the user their settings.json was reshaped, not silently rewritten.
   */
  migratedKeys?: string[];
}

/** A persona template an agent can activate through `roles` / `activeRole`. */
export interface RolePreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: string;
  accent: string;
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
  /** Optional: persona templates the UI renders in the persona tab. */
  getRolePresets?(): RolePreset[];
  /** Optional: models the agent runtime itself reports as selectable (e.g. `omp models`). */
  getAvailableModels?(): Promise<unknown[]>;
  /** Optional: role→model bindings the runtime stores outside settings.json. */
  getModelRoles?(): Promise<Record<string, string>>;
  setModelRoles?(roles: Record<string, string>): Promise<Record<string, string>>;
}

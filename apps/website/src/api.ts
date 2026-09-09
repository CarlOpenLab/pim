import type {
  AgentConfiguration,
  AgentSummary,
  ConfigScope,
  ModelsConfiguration,
  OmpAvailableModel,
  OmpRolePreset,
  ProviderPreset,
  SaveResult,
} from "./types.ts";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload;
}

export async function getDefaultProjectPath(): Promise<string> {
  const health = await request<{ projectPath: string }>("/api/health");
  return health.projectPath;
}

export async function listAgents(): Promise<AgentSummary[]> {
  const payload = await request<{ agents: AgentSummary[] }>("/api/agents");
  return payload.agents;
}

export function loadConfiguration(
  agentId: string,
  scope: ConfigScope,
  projectPath: string,
): Promise<AgentConfiguration> {
  const params = new URLSearchParams({ scope, projectPath });
  return request(`/api/agents/${agentId}/configuration?${params.toString()}`);
}

export function saveSettings(
  agentId: string,
  scope: ConfigScope,
  projectPath: string,
  settings: Record<string, unknown>,
): Promise<SaveResult> {
  return request(`/api/agents/${agentId}/settings`, {
    method: "PUT",
    body: JSON.stringify({ scope, projectPath, settings }),
  });
}

export async function listModelPresets(agentId: string): Promise<ProviderPreset[]> {
  const payload = await request<{ presets: ProviderPreset[] }>(
    `/api/agents/${agentId}/model-presets`,
  );
  return payload.presets;
}

/** Rebuilds presets from upstream docs (e.g. the OpenCode Go model catalog). */
export async function refreshAgentPresets(agentId: string): Promise<ProviderPreset[]> {
  const payload = await request<{ presets: ProviderPreset[] }>(
    `/api/agents/${agentId}/presets/refresh`,
    { method: "POST" },
  );
  return payload.presets;
}
export async function listRolePresets(agentId: string): Promise<OmpRolePreset[]> {
  const payload = await request<{ presets: OmpRolePreset[] }>(
    `/api/agents/${agentId}/role-presets`,
  );
  return payload.presets;
}

export async function listAvailableModels(agentId: string): Promise<OmpAvailableModel[]> {
  const payload = await request<{ models: OmpAvailableModel[] }>(
    `/api/agents/${agentId}/available-models`,
  );
  return payload.models;
}

export async function getModelRoles(agentId: string): Promise<Record<string, string>> {
  const payload = await request<{ roles: Record<string, string> }>(
    `/api/agents/${agentId}/model-roles`,
  );
  return payload.roles;
}

export async function saveModelRoles(
  agentId: string,
  roles: Record<string, string>,
): Promise<Record<string, string>> {
  const payload = await request<{ roles: Record<string, string> }>(
    `/api/agents/${agentId}/model-roles`,
    { method: "PUT", body: JSON.stringify({ roles }) },
  );
  return payload.roles;
}

export function saveModels(agentId: string, models: ModelsConfiguration): Promise<SaveResult> {
  return request(`/api/agents/${agentId}/models`, {
    method: "PUT",
    body: JSON.stringify({ models }),
  });
}

export async function logoutProvider(
  agentId: string,
  providerId: string,
): Promise<{ success: boolean; message: string }> {
  return request(`/api/agents/${agentId}/auth-broker/logout`, {
    method: "POST",
    body: JSON.stringify({ providerId }),
  });
}

export async function checkCredential(
  agentId: string,
  providerId: string,
): Promise<{ provider: string; type: string; configured: boolean; environmentKeys: string[] }> {
  const payload = await request<{
    provider: string;
    type: string;
    configured: boolean;
    environmentKeys: string[];
  }>(`/api/agents/${agentId}/auth-broker/check?providerId=${encodeURIComponent(providerId)}`);
  return payload;
}

export async function setApiKey(
  agentId: string,
  providerId: string,
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  return request(`/api/agents/${agentId}/auth-broker/set-key`, {
    method: "POST",
    body: JSON.stringify({ providerId, apiKey }),
  });
}

import type {
  AgentConfiguration,
  AgentSummary,
  ConfigScope,
  ModelsConfiguration,
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

export function saveModels(agentId: string, models: ModelsConfiguration): Promise<SaveResult> {
  return request(`/api/agents/${agentId}/models`, {
    method: "PUT",
    body: JSON.stringify({ models }),
  });
}

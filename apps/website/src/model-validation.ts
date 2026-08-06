/**
 * The same rules the API enforces on write, checked in the browser so a half-filled row is
 * pointed at in place instead of coming back as a schema error after the save round trip.
 */
import type { ModelsConfiguration } from "./types.ts";

export interface ModelIssue {
  providerId: string;
  /** Index into the provider's `models`, or null when the problem is on the provider itself. */
  modelIndex: number | null;
  message: string;
}

function isAcceptableUrl(value: string): boolean {
  if (value.startsWith("http://localhost")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function checkCount(value: unknown, label: string): string | null {
  // Cleared number inputs hand back null; `pruneEmptyValues` drops those before the write.
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0)
    return `${label}需要是正整数，留空表示不设置`;
  return null;
}

/**
 * Clearing a number input leaves `null` behind, which no field in models.json accepts.
 * Null means "not set" here, so it is dropped in place right before a save.
 */
export function pruneEmptyValues(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) pruneEmptyValues(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    if (item === null) delete (value as Record<string, unknown>)[key];
    else pruneEmptyValues(item);
  }
}

export function validateModels(models: ModelsConfiguration): ModelIssue[] {
  const issues: ModelIssue[] = [];

  for (const [providerId, provider] of Object.entries(models.providers ?? {})) {
    if (provider.baseUrl !== undefined && !isAcceptableUrl(provider.baseUrl))
      issues.push({
        providerId,
        modelIndex: null,
        message: "Base URL 需要是完整地址，例如 https://api.example.com/v1",
      });

    const seen = new Map<string, number>();
    for (const [index, model] of (provider.models ?? []).entries()) {
      const id = model.id?.trim() ?? "";
      if (!id) {
        issues.push({ providerId, modelIndex: index, message: "模型 ID 不能为空" });
      } else if (seen.has(id)) {
        issues.push({
          providerId,
          modelIndex: index,
          message: `模型 ID「${id}」与第 ${(seen.get(id) ?? 0) + 1} 行重复`,
        });
      } else {
        seen.set(id, index);
      }

      for (const [value, label] of [
        [model.contextWindow, "上下文窗口"],
        [model.maxTokens, "最大输出"],
      ] as const) {
        const message = checkCount(value, label);
        if (message) issues.push({ providerId, modelIndex: index, message });
      }
    }
  }

  return issues;
}

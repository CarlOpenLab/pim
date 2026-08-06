/**
 * PIM never stores secret values. Configuration files only ever hold a `$VAR_NAME`
 * reference (or a `!command`); the agent resolves it from its own environment when it
 * authenticates, so the plaintext lives in that process and nowhere else.
 */
import type { ModelsConfiguration, SecretReference } from "./adapters/types.js";

const namePattern = /^[A-Za-z_][A-Za-z0-9_]{1,63}$/;
const referencePattern = /^\$([A-Za-z_][A-Za-z0-9_]{1,63})$/;

/** Sentinel the API sends instead of a literal value found on disk. */
export const REDACTED = "__PIM_REDACTED__";

export function isSecretName(value: string): boolean {
  return namePattern.test(value);
}

/** Returns the variable name behind a `$NAME` reference, or null for anything else. */
export function parseSecretReference(value: unknown): string | null {
  return typeof value === "string" ? (referencePattern.exec(value)?.[1] ?? null) : null;
}

/** `$VAR`, `!command`, or the redaction sentinel — anything else is a literal secret. */
export function isSecretPlaceholder(value: string): boolean {
  return value === REDACTED || value.startsWith("!") || parseSecretReference(value) !== null;
}

function isSecretField(key: string, parentKey?: string): boolean {
  return key === "apiKey" || key === "oauth" || parentKey === "headers";
}

function walkSecrets(
  value: unknown,
  visit: (path: string, value: string) => void,
  path = "",
  parentKey?: string,
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries())
      walkSecrets(item, visit, `${path}[${index}]`, parentKey);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key;
    if (typeof item === "string") {
      if (isSecretField(key, parentKey)) visit(itemPath, item);
    } else {
      walkSecrets(item, visit, itemPath, key);
    }
  }
}

/**
 * Rejects literal secrets before they reach disk. This is the guard behind the UI: the
 * forms only produce references, but the advanced JSON editor can produce anything.
 */
export function assertNoLiteralSecrets(value: unknown): void {
  const offenders: string[] = [];
  walkSecrets(value, (path, item) => {
    if (item && !isSecretPlaceholder(item)) offenders.push(path);
  });
  if (offenders.length > 0)
    throw new Error(
      `配置里不能写明文密钥（${offenders.join("、")}）。请改用 $VAR_NAME 引用环境变量，由 Agent 启动时自行读取。`,
    );
}

/** Collects the `$VAR` references a model configuration depends on, with usage sites. */
export function collectSecretReferences(models: ModelsConfiguration): SecretReference[] {
  const references = new Map<string, Set<string>>();

  for (const [providerId, provider] of Object.entries(models.providers ?? {})) {
    walkSecrets(provider, (_path, item) => {
      const name = parseSecretReference(item);
      if (!name) return;
      const providers = references.get(name) ?? new Set<string>();
      providers.add(providerId);
      references.set(name, providers);
    });
  }

  return [...references]
    .map(([name, providers]) => ({
      name,
      present: Boolean(process.env[name]),
      usedBy: [...providers].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

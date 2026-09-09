import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
/// <reference types="vitest/globals" />
import {
  readFirstExistingDocument,
  readJsonDocument,
  readYamlDocument,
  writeJsonAtomic,
  writeYamlAtomic,
} from "../src/adapters/json-file.ts";
import { restoreSecrets, sanitizeModels } from "../src/adapters/pi.ts";
import type { ModelsConfiguration } from "../src/adapters/types.ts";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "pim-test-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("reads JSONC configuration", async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, "settings.json");
  await writeJsonAtomic(path, { theme: "dark" });
  const content = await readFile(path, "utf8");
  await writeFile(path, `// Pi settings\n${content.replace("\n}", ",\n}")}`);

  const document = await readJsonDocument(path, {});

  expect(document.data).toEqual({ theme: "dark" });
  expect(document.diagnostics).toEqual([]);
});

test("returns diagnostics instead of throwing for malformed JSON", async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, "models.json");
  await writeFile(path, '{ "providers": {');

  const document = await readJsonDocument(path, { providers: {} });

  expect(document.data).toEqual({ providers: {} });
  expect(document.diagnostics[0]?.level).toBe("error");
});

test("recursively redacts and restores literal model secrets", () => {
  const original: ModelsConfiguration = {
    providers: {
      proxy: {
        apiKey: "literal-provider-secret",
        headers: { authorization: "literal-header", trace: "$TRACE_ID" },
        modelOverrides: {
          model: { headers: { "x-model-secret": "nested-secret" } },
        },
      },
    },
  };

  const sanitized = sanitizeModels(original);
  const provider = sanitized.providers.proxy;

  expect(provider?.apiKey).toBe("__PIM_REDACTED__");
  expect(provider?.headers).toEqual({
    authorization: "__PIM_REDACTED__",
    trace: "$TRACE_ID",
  });
  expect(provider?.modelOverrides?.model?.headers).toEqual({
    "x-model-secret": "__PIM_REDACTED__",
  });
  expect(restoreSecrets(sanitized, original)).toEqual(original);
});

test("atomically writes and backs up an existing file", async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, "settings.json");
  await writeJsonAtomic(path, { theme: "dark" });

  const result = await writeJsonAtomic(path, { theme: "light" });

  expect(result.backupPath).toBeTruthy();
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ theme: "light" });
  expect(JSON.parse(await readFile(result.backupPath!, "utf8"))).toEqual({ theme: "dark" });
});

test("atomically writes, backs up, and reads YAML documents", async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, "models.yml");
  await writeYamlAtomic(path, { providers: { first: { baseUrl: "https://first.com" } } });

  const document1 = await readYamlDocument(path, { providers: {} });
  expect(document1.data).toEqual({ providers: { first: { baseUrl: "https://first.com" } } });

  const result = await writeYamlAtomic(path, {
    providers: { second: { baseUrl: "https://second.com" } },
  });
  expect(result.backupPath).toBeTruthy();

  const document2 = await readYamlDocument(path, { providers: {} });
  expect(document2.data).toEqual({ providers: { second: { baseUrl: "https://second.com" } } });
});

test("readFirstExistingDocument selects first available document across YAML and JSON", async () => {
  const directory = await temporaryDirectory();
  const ymlPath = join(directory, "models.yml");
  const jsonPath = join(directory, "models.json");

  // When only json exists
  await writeJsonAtomic(jsonPath, { source: "json" });
  const doc1 = await readFirstExistingDocument([ymlPath, jsonPath], { source: "none" });
  expect(doc1.path).toBe(jsonPath);
  expect((doc1.data as any).source).toBe("json");

  // When yml is added, it takes precedence
  await writeYamlAtomic(ymlPath, { source: "yml" });
  const doc2 = await readFirstExistingDocument([ymlPath, jsonPath], { source: "none" });
  expect(doc2.path).toBe(ymlPath);
  expect((doc2.data as any).source).toBe("yml");
});

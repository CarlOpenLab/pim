/// <reference types="vitest/globals" />
import {
  assertNoLiteralSecrets,
  collectSecretReferences,
  isSecretPlaceholder,
  parseSecretReference,
} from "../src/secret-ref.ts";
import type { ModelsConfiguration } from "../src/adapters/types.ts";

test("recognises references, commands, and the redaction sentinel", () => {
  expect(parseSecretReference("$PI_API_KEY")).toBe("PI_API_KEY");
  expect(parseSecretReference("$not a name")).toBeNull();
  expect(parseSecretReference("sk-literal")).toBeNull();

  expect(isSecretPlaceholder("$PI_API_KEY")).toBe(true);
  expect(isSecretPlaceholder("!op read op://vault/key")).toBe(true);
  expect(isSecretPlaceholder("__PIM_REDACTED__")).toBe(true);
  expect(isSecretPlaceholder("sk-literal")).toBe(false);
});

test("rejects literal secrets anywhere in a model configuration", () => {
  expect(() =>
    assertNoLiteralSecrets({
      providers: {
        proxy: { apiKey: "$PI_PROXY_API_KEY", headers: { authorization: "$PI_PROXY_HEADER" } },
      },
    }),
  ).not.toThrow();

  expect(() => assertNoLiteralSecrets({ providers: { proxy: { apiKey: "sk-literal" } } })).toThrow(
    /providers\.proxy\.apiKey/,
  );

  expect(() =>
    assertNoLiteralSecrets({
      providers: { proxy: { modelOverrides: { model: { headers: { "x-key": "literal" } } } } },
    }),
  ).toThrow(/x-key/);
});

test("collects references with their provider usage", () => {
  process.env.PIM_TEST_PRESENT_KEY = "value";
  const models: ModelsConfiguration = {
    providers: {
      alpha: { apiKey: "$PIM_TEST_PRESENT_KEY" },
      beta: { apiKey: "$PIM_TEST_PRESENT_KEY" },
      gamma: { apiKey: "$PIM_TEST_MISSING_KEY" },
    },
  };

  const references = collectSecretReferences(models);

  expect(references).toEqual([
    { name: "PIM_TEST_MISSING_KEY", present: false, usedBy: ["gamma"] },
    { name: "PIM_TEST_PRESENT_KEY", present: true, usedBy: ["alpha", "beta"] },
  ]);
  delete process.env.PIM_TEST_PRESENT_KEY;
});

/// <reference types="vitest/globals" />
import { piModelsSchema } from "../src/adapters/pi.ts";
import { assertNoLiteralSecrets } from "../src/secret-ref.ts";
import { piModelPresets } from "../src/presets/pi.ts";

test("every shipped preset is writable as-is", () => {
  for (const preset of piModelPresets) {
    const models = { providers: { [preset.id]: { ...preset.provider, models: preset.models } } };

    expect(() => piModelsSchema.parse(models), preset.id).not.toThrow();
    // A preset must never carry a key value, only a `$VAR_NAME` reference.
    expect(() => assertNoLiteralSecrets(models), preset.id).not.toThrow();
  }
});

test("preset ids and model ids are unique", () => {
  const presetIds = piModelPresets.map((preset) => preset.id);
  expect(new Set(presetIds).size).toBe(presetIds.length);

  for (const preset of piModelPresets) {
    const modelIds = preset.models.map((model) => model.id);
    expect(new Set(modelIds).size, preset.id).toBe(modelIds.length);
  }
});

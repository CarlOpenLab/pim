<script setup lang="ts">
import { Check, Code2, Copy, Pencil, RotateCcw, WrapText } from "@lucide/vue";
import { message } from "antdv-next";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  value: Record<string, unknown>;
  title: string;
  path: string;
  hasError?: boolean;
}>();
const emit = defineEmits<{ apply: [value: Record<string, unknown>] }>();
const editing = ref(false);
const raw = ref("");
const error = ref("");
const copied = ref(false);
const serialized = computed(() => JSON.stringify(props.value, null, 2));
watch(
  serialized,
  (value) => {
    if (!editing.value) raw.value = value;
  },
  { immediate: true },
);

/**
 * The API reads these files as JSONC, so the editor accepts comments and trailing
 * commas too; writes stay standard JSON (parsed here first, stringified on save).
 */
function parseDocument(text: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const parsed: unknown = parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const first = errors[0]!;
    throw new Error(`${printParseErrorCode(first.error)} at offset ${first.offset}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("根节点必须是 JSON 对象");
  return parsed as Record<string, unknown>;
}

function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "JSON 格式无效";
}

function apply() {
  try {
    emit("apply", parseDocument(raw.value));
    editing.value = false;
    error.value = "";
    message.success("JSON 已应用到编辑器");
  } catch (cause) {
    error.value = describeError(cause);
    message.error(error.value);
  }
}

function format() {
  try {
    const parsed = parseDocument(editing.value ? raw.value : serialized.value);
    raw.value = JSON.stringify(parsed, null, 2);
    error.value = "";
  } catch (cause) {
    error.value = describeError(cause);
  }
}

async function copyJson() {
  await navigator.clipboard.writeText(editing.value ? raw.value : serialized.value);
  copied.value = true;
  message.success("已复制到剪贴板");
  setTimeout(() => (copied.value = false), 1500);
}

function cancel() {
  raw.value = serialized.value;
  error.value = "";
  editing.value = false;
}
</script>

<template>
  <div class="json-inspector">
    <a-alert
      v-if="hasError"
      type="error"
      show-icon
      message="当前文件存在格式或 schema 错误"
      class="json-alert"
    />
    <div class="json-toolbar">
      <div>
        <a-typography-text strong>{{ title }}</a-typography-text
        ><a-typography-text type="secondary" class="json-path">{{ path }}</a-typography-text>
      </div>
      <a-space
        ><a-button type="text" size="small" @click="format"><WrapText :size="15" />格式化</a-button
        ><a-button type="text" size="small" @click="copyJson"
          ><Copy :size="15" />{{ copied ? "已复制" : "复制" }}</a-button
        ><a-button v-if="!editing" type="text" @click="editing = true"
          ><Pencil :size="15" />编辑</a-button
        ><template v-else
          ><a-button type="primary" ghost @click="apply"><Check :size="15" />应用</a-button
          ><a-button type="text" @click="cancel"><RotateCcw :size="15" />取消</a-button></template
        ></a-space
      >
    </div>
    <a-alert
      v-if="error"
      type="error"
      show-icon
      :message="error"
      class="json-alert"
      closable
      @close="error = ''"
    />
    <textarea v-if="editing" v-model="raw" class="json-editor" spellcheck="false" />
    <pre v-else class="json-code"><code>{{ serialized }}</code></pre>
    <a-typography-text type="secondary" class="json-note"
      ><Code2 :size="14" />支持注释与尾逗号（保存时转为标准
      JSON）；保存时会保留未知字段，敏感字面值只在后端保存，前端始终脱敏。</a-typography-text
    >
  </div>
</template>

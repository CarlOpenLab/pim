<script setup lang="ts">
import { Check, Code2, Pencil, RotateCcw } from "@lucide/vue";
import message from "antdv-next/dist/message/index";
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
const serialized = computed(() => JSON.stringify(props.value, null, 2));
watch(
  serialized,
  (value) => {
    if (!editing.value) raw.value = value;
  },
  { immediate: true },
);

function apply() {
  try {
    const parsed: unknown = JSON.parse(raw.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("根节点必须是 JSON 对象");
    emit("apply", parsed as Record<string, unknown>);
    editing.value = false;
    message.success("JSON 已应用到编辑器");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "JSON 格式无效");
  }
}

function cancel() {
  raw.value = serialized.value;
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
        ><a-button v-if="!editing" type="text" @click="editing = true"
          ><Pencil :size="15" />编辑</a-button
        ><template v-else
          ><a-button type="primary" ghost @click="apply"><Check :size="15" />应用</a-button
          ><a-button type="text" @click="cancel"><RotateCcw :size="15" />取消</a-button></template
        ></a-space
      >
    </div>
    <textarea v-if="editing" v-model="raw" class="json-editor" spellcheck="false" />
    <pre v-else class="json-code"><code>{{ serialized }}</code></pre>
    <a-typography-text type="secondary" class="json-note"
      ><Code2
        :size="14"
      />保存时会保留未知字段；敏感字面值只在后端保存，前端始终脱敏。</a-typography-text
    >
  </div>
</template>

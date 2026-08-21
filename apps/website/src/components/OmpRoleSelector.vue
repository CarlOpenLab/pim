<script setup lang="ts">
import { computed } from "vue";
import { Check, Sparkles } from "@lucide/vue";
import type { OmpRolePreset } from "../types.ts";

const props = defineProps<{
  activeId: string;
  presets: OmpRolePreset[];
  customRoles?: Array<{
    id: string;
    label?: string;
    name?: string;
    description?: string;
    prompt?: string;
    icon?: string;
    accent?: string;
  }>;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const allRoles = computed(() => {
  if (props.customRoles && props.customRoles.length) {
    // custom roles override visuals but keep preset look if id matches
    const map = new Map(props.presets.map((p) => [p.id, p]));
    return props.customRoles.map((r) => {
      const preset = map.get(r.id);
      return preset
        ? { ...preset, ...r, label: r.label ?? r.name ?? preset.label }
        : {
            id: r.id,
            label: r.label ?? r.name ?? r.id,
            description: r.description ?? "自定义角色",
            prompt: r.prompt ?? "",
            icon: r.icon ?? "🎭",
            accent: r.accent ?? "#1677ff",
          };
    });
  }
  return props.presets;
});
</script>

<template>
  <div class="omp-roles">
    <div class="omp-roles-head">
      <Sparkles :size="16" />
      <span>角色选择</span>
      <a-typography-text type="secondary">选择 OMP 当前会话的默认人格与提示词</a-typography-text>
    </div>
    <div class="omp-role-grid">
      <button
        v-for="role in allRoles"
        :key="role.id"
        type="button"
        class="omp-role-card"
        :class="{ active: role.id === activeId }"
        :style="{ '--accent': role.accent } as any"
        @click="emit('select', role.id)"
      >
        <span class="omp-role-icon" :style="{ background: role.accent }">{{ role.icon }}</span>
        <span class="omp-role-label">{{ role.label }}</span>
        <span class="omp-role-desc">{{ role.description }}</span>
        <span v-if="role.id === activeId" class="omp-role-check"><Check :size="14" /></span>
      </button>
    </div>
    <div class="omp-role-prompt">
      <a-typography-text type="secondary" class="omp-role-prompt-label"
        >当前角色 Prompt 预览</a-typography-text
      >
      <div class="omp-prompt-box">
        {{ allRoles.find((r) => r.id === activeId)?.prompt || "— 未选择角色 —" }}
      </div>
    </div>
  </div>
</template>

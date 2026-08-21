<script setup lang="ts">
import { Plus } from "@lucide/vue";
import type { AgentSummary } from "../types.ts";

defineProps<{ agents: AgentSummary[]; activeId: string }>();
defineEmits<{ select: [id: string] }>();

const glyphs: Record<string, string> = { pi: "π", omp: "⬢" };
const accents: Record<string, string> = { pi: "#1677ff", omp: "#722ed1" };

function glyph(agent: AgentSummary) {
  return glyphs[agent.id] ?? agent.name.slice(0, 1).toUpperCase();
}
function accent(agent: AgentSummary) {
  return accents[agent.id] ?? "#1677ff";
}
</script>

<template>
  <nav class="agent-rail">
    <div class="rail-brand" title="PIM Agent Config Studio">P</div>
    <a-tooltip
      v-for="agent in agents"
      :key="agent.id"
      placement="right"
      :title="`${agent.name}${agent.version ? ` · ${agent.version}` : ' · 未检测到 CLI'}`"
    >
      <button
        type="button"
        class="rail-agent"
        :class="{ active: agent.id === activeId, offline: !agent.available }"
        :style="
          agent.id === activeId
            ? {
                background: `${accent(agent)}14`,
                borderColor: `${accent(agent)}40`,
                color: accent(agent),
              }
            : undefined
        "
        @click="$emit('select', agent.id)"
      >
        {{ glyph(agent) }}
        <span
          class="rail-dot"
          :class="{ online: agent.available }"
          :style="agent.available ? { background: accent(agent) } : undefined"
        />
      </button>
    </a-tooltip>
    <a-tooltip placement="right" title="更多 Agent 适配中">
      <button type="button" class="rail-add" disabled><Plus :size="17" /></button>
    </a-tooltip>
  </nav>
</template>

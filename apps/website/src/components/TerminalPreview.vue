<script setup lang="ts">
import { computed } from "vue";
import type { TerminalConfig } from "../types.ts";

const props = defineProps<{ config: TerminalConfig }>();

const style = computed(() => {
  const bg = props.config.background || (props.config.theme === "light" ? "#fafafa" : "#0f1115");
  const font = props.config.fontFamily || "SFMono-Regular, Menlo, monospace";
  const size = `${props.config.fontSize ?? 13}px`;
  const opacity = String(props.config.opacity ?? 1);
  const accent = props.config.accent || "#1677ff";
  return {
    background: bg,
    fontFamily: font,
    fontSize: size,
    opacity,
    "--accent": accent,
  } as any;
});
</script>

<template>
  <div
    class="terminal-preview"
    :style="style"
    :class="{ blur: config.blur, light: config.theme === 'light' }"
  >
    <div class="term-bar">
      <span class="term-dot red" />
      <span class="term-dot yellow" />
      <span class="term-dot green" />
      <span class="term-title"
        >omp — {{ config.theme === "light" ? "light" : "dark" }} ·
        {{ config.fontFamily?.split(",")[0] || "SFMono" }} {{ config.fontSize ?? 13 }}px</span
      >
    </div>
    <div class="term-body">
      <div class="term-line">
        <span class="term-prompt">❯</span> omp --role coder --model claude-sonnet-4-5
      </div>
      <div class="term-line muted">
        Using role <b>全栈工程师</b> · model <b>claude-sonnet-4-5</b>
      </div>
      <div class="term-line"><span class="term-accent">assistant:</span> 已就绪，输入你的需求…</div>
      <div class="term-line">
        <span class="term-prompt">❯</span>
        <span
          class="term-cursor"
          :class="config.cursorStyle || 'block'"
          :style="{ animationPlayState: config.cursorBlink === false ? 'paused' : 'running' }"
          >▍</span
        >
      </div>
    </div>
  </div>
</template>

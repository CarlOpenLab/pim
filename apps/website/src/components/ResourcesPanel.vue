<script setup lang="ts">
import { Boxes, FileCode2, Package, Paintbrush, Plus, Sparkles, Trash2 } from "@lucide/vue";
import { reactive, ref } from "vue";

const props = defineProps<{ settings: Record<string, unknown> }>();
const activeKeys = ref(["extensions", "skills"]);
const resourceItems = [
  {
    key: "extensions",
    title: "Extensions",
    description: "TypeScript 工具、命令与事件处理器",
    icon: FileCode2,
  },
  { key: "skills", title: "Skills", description: "按需加载的 Agent Skills", icon: Sparkles },
  {
    key: "prompts",
    title: "Prompt templates",
    description: "可通过 /name 调用的 Markdown 模板",
    icon: Boxes,
  },
  { key: "themes", title: "Themes", description: "自定义终端主题 JSON 文件", icon: Paintbrush },
  {
    key: "packages",
    title: "Pi packages",
    description: "npm、git 或本地路径分发的资源包",
    icon: Package,
  },
];
const drafts = reactive<Record<string, string>>({});

function getResources(key: string): string[] {
  return Array.isArray(props.settings[key]) ? (props.settings[key] as string[]) : [];
}

function removeResource(key: string, index: number) {
  props.settings[key] = getResources(key).filter((_, currentIndex) => currentIndex !== index);
}

function addResource(key: string) {
  const value = drafts[key]?.trim();
  if (!value) return;
  props.settings[key] = [...getResources(key), value];
  drafts[key] = "";
}
</script>

<template>
  <a-card :bordered="false" class="panel-card">
    <a-alert type="info" show-icon class="resource-info"
      ><template #message>资源路径解析规则</template
      ><template #description
        >全局配置路径相对于
        <a-typography-text code>~/.pi/agent</a-typography-text>，项目配置路径相对于
        <a-typography-text code>.pi</a-typography-text>。支持 glob、<a-typography-text code
          >!exclude</a-typography-text
        >、<a-typography-text code>+include</a-typography-text> 和
        <a-typography-text code>-exclude</a-typography-text>。</template
      ></a-alert
    >
    <a-collapse v-model:active-key="activeKeys" ghost class="resource-collapse">
      <a-collapse-panel v-for="item in resourceItems" :key="item.key">
        <template #header
          ><a-space
            ><component :is="item.icon" :size="17" /><span class="resource-title">{{
              item.title
            }}</span
            ><a-typography-text type="secondary">{{ item.description }}</a-typography-text></a-space
          ></template
        >
        <template #extra
          ><a-badge
            :count="getResources(item.key).length"
            show-zero
            :number-style="{ backgroundColor: '#e6f4ff', color: '#1677ff', boxShadow: 'none' }"
        /></template>
        <div class="resource-list">
          <div
            v-for="(path, index) in getResources(item.key)"
            :key="`${path}-${index}`"
            class="resource-list-item"
          >
            <a-typography-text code ellipsis :content="path">{{ path }}</a-typography-text
            ><a-tooltip title="移除"
              ><a-button
                type="text"
                danger
                shape="circle"
                @click.stop="removeResource(item.key, index)"
                ><Trash2 :size="15" /></a-button
            ></a-tooltip>
          </div>
          <a-empty
            v-if="getResources(item.key).length === 0"
            :image="null"
            description="未配置资源"
          />
        </div>
        <div class="resource-add">
          <a-input
            v-model:value="drafts[item.key]"
            placeholder="输入资源路径"
            @press-enter="addResource(item.key)"
          /><a-button type="primary" @click="addResource(item.key)"
            ><Plus :size="16" />添加</a-button
          >
        </div>
      </a-collapse-panel>
    </a-collapse>
  </a-card>
</template>

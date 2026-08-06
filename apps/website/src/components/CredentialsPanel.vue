<script setup lang="ts">
import { KeyRound, ShieldCheck } from "@lucide/vue";
import type { CredentialStatus, SecretReference } from "../types.ts";

defineProps<{
  credentials: CredentialStatus[];
  secretRefs: SecretReference[];
  configDir: string;
}>();
</script>

<template>
  <div class="panel-stack">
    <a-alert type="info" show-icon
      ><template #message>PIM 不保存任何密钥</template
      ><template #description
        >配置文件里只写 <a-typography-text code>$VAR_NAME</a-typography-text> 引用。Agent
        启动时从自己的进程环境读取变量值去授权，密钥只存在于该进程内存中。</template
      ></a-alert
    >

    <a-card :bordered="false" class="panel-card">
      <template #title
        ><span class="card-title"><KeyRound :size="15" />环境变量引用</span></template
      >
      <template #extra
        ><a-typography-text type="secondary">来自 models.json</a-typography-text></template
      >
      <div v-if="secretRefs.length" class="ref-list">
        <div v-for="reference in secretRefs" :key="reference.name" class="ref-item">
          <a-typography-text code>${{ reference.name }}</a-typography-text>
          <a-typography-text type="secondary" class="ref-usage"
            >被 {{ reference.usedBy.join("、") }} 使用</a-typography-text
          >
          <a-tag v-if="reference.present" color="success">已就绪</a-tag>
          <a-tooltip v-else title="PIM 进程的环境里没有这个变量；请在启动 Agent 的 shell 中 export"
            ><a-tag color="warning">未检测到</a-tag></a-tooltip
          >
        </div>
      </div>
      <a-empty v-else :image="null" description="models.json 里还没有变量引用" />
    </a-card>

    <a-card :bordered="false" class="panel-card">
      <template #title
        ><span class="card-title"><ShieldCheck :size="15" />已登录凭据</span></template
      >
      <template #extra
        ><a-typography-text type="secondary">{{ configDir }}/auth.json</a-typography-text></template
      >
      <div v-if="credentials.length" class="ref-list">
        <div v-for="item in credentials" :key="item.provider" class="ref-item">
          <a-typography-text code>{{ item.provider }}</a-typography-text>
          <a-typography-text type="secondary" class="ref-usage">{{ item.type }}</a-typography-text>
          <a-tag :color="item.configured ? 'success' : 'default'">{{
            item.configured ? "已授权" : "未完成"
          }}</a-tag>
        </div>
      </div>
      <a-empty v-else :image="null" description="Agent 尚未写入登录凭据" />
    </a-card>
  </div>
</template>

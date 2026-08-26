import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    globals: true,
  },
  run: {
    // dev 是常驻进程，绝不能缓存；默认 { scripts: false, tasks: true } 即正确
    // 之前 cache: true 会把 `vp run dev` 当成可缓存任务，导致 vp 提前退出、子进程变孤儿
    cache: {
      scripts: false,
      tasks: true,
    },
  },
});

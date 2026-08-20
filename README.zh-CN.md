# PIM

PIM 是一个面向终端 Agent 框架的本地优先配置工作室。首个适配器针对 [Pi](https://pi.dev);该适配器边界设计上未来将支持 OMP 及其他 Agent TUI。

## 当前范围

- 全局与项目级 Pi `settings.json`
- `models.json` 中的自定义服务商与模型,包括单模型上下文窗口、输出上限、API 形态、能力声明、每百万 Token 定价,以及服务商专属的 `compat` 开关
- 服务商模板,使新增服务商或模型可从可用基线起步
- 从 `auth.json` 读取凭据状态,不返回任何密钥值
- 扩展、技能、提示词模板、主题及包路径
- 结构化表单与高级 JSON 编辑器
- 读取 JSONC、Schema 校验、原子化写入以及带时间戳的备份

## 密钥

PIM 只配置模型——从不处理密钥。配置文件仅保存 `$VAR_NAME` 引用;Agent 在认证时从自身环境中读取该变量,因此明文仅存在于 Agent 进程中。

- 表单只会产出引用,`apps/api/src/secret-ref.ts` 在写入时会拒绝字面量 `apiKey`、`oauth` 与 header 值——包括在高级 JSON 编辑器中输入的任何内容。
- 磁盘上已存在的字面量值会以 `__PIM_REDACTED__` 形式发送至浏览器,保存时由 API 还原,并在 UI 中标记,提供一键切换为引用的选项。
- 配置载荷中的 `secretRefs` 汇报某项配置需要哪些变量,以及这些变量是否存在于 PIM 进程环境中——仅返回布尔值,绝不返回值本身。

PIM 将其 API 绑定到 `127.0.0.1`。

## 模型预设

`apps/api/src/presets/pi.ts` 保存了 `GET /api/agents/:id/model-presets` 提供的服务商模板。它们是起点而非事实来源:连接字段是持久部分,而模型 ID 与价格会随厂商发布而变动,因此 UI 会提示用户校验导入内容。预设绝不携带密钥值——只有 `$VAR_NAME` 引用,`apps/api/tests/model-presets.test.ts` 会连同写入 Schema 一并断言这一点。

编辑在两处进行。模型表格覆盖值得在目录中横向扫描的字段;单模型抽屉覆盖其余所有字段,其中 `compat` 作为 JSON 字段保留,因为其键由服务商决定。`apps/website/src/model-validation.ts` 运行与 API 写入时相同的规则,因此不完整的行会被就地指出,而非以 Schema 错误的形式返回。

预设也可以不经过代码改动直接从官方文档重建。模型目录卡片上有「刷新预设」按钮(`POST /api/agents/:id/presets/refresh`,由 `apps/api/src/presets/opencode-go.ts` 实现);它会重新抓取 OpenCode Go 文档,解析模型 ID、接口形态与每百万 Token 价格,并把结果缓存在 Agent 配置目录下,重启后仍然有效。未实现 `refreshPresets()` 的适配器不会显示该按钮。

## 新增 Agent

`AgentAdapter`(`apps/api/src/adapters/types.ts`)是 Agent 唯一需要实现的内容。在 `pi.ts` 旁实现它,在 `apps/api/src/index.ts` 的 `adapters` 映射中注册,并声明其 `capabilities`——UI 从 `GET /api/agents` 推导 Agent 导航栏及其标签页,因此无需改动前端。`modelPresets` 为可选项;省略它的适配器只会得到一个纯手动的添加流程。

## 开发

安装依赖并启动两个服务:

```bash
vp install
vp run dev
```

- Web UI:http://localhost:5173
- 本地 API:http://127.0.0.1:8787

开发环境下,网站会将 `/api` 请求代理至本地 API。

## 校验

```bash
vp run ready
```

该命令会运行格式化、Lint、类型检查、测试以及所有工作区的构建。

## 项目结构

- `apps/website`:Vue 3 + Antdv Next 配置界面
- `apps/api`:Hono 本地 API 与 Agent 适配器
- `apps/api/src/adapters/pi.ts`:Pi 专属路径、Schema、密钥处理与持久化
- `packages/utils`:入门级共享包,可用于抽取跨适配器通用工具

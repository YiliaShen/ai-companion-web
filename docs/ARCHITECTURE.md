# Mira 架构基线

## 总原则

这是一个本地优先、可静态部署的 React PWA。默认不依赖自建服务器：

- 对话、记忆、相册、设置持久化在浏览器 IndexedDB。
- demo provider 在浏览器内生成稳定、可重复的角色回复。
- live provider 直接请求用户配置的 OpenAI 兼容 API。
- API Key 默认只保存在 `sessionStorage`；用户显式勾选后才进入 `localStorage`。
- 静态资源可部署到 GitHub Pages、Cloudflare Pages 或任意静态托管。

## 模块边界

```text
src/
  app/            # 应用装配、路由状态、全局 Provider
  components/     # 跨功能的基础组件
  features/
    onboarding/   # 首次选择角色
    chat/         # 会话、消息、输入框、流式状态
    memory/       # 记忆星图与编辑
    album/        # 专属相册
    audio/        # Web Audio 氛围音
    settings/     # provider、隐私、数据管理
    safety/       # 危机提示与依赖提醒
  core/
    personas/     # 人设定义与 prompt 编译
    emotion/      # 场景—情绪—策略分析
    memory/       # 提取与召回
    providers/    # demo / OpenAI 兼容 provider
    storage/      # IndexedDB repository + migrations
    safety/       # 安全规则
    images/       # 场景照片映射
  state/          # AppController 与 React state adapter
  styles/         # tokens + 全局样式
  contracts/      # 冻结领域与服务接口
```

任何模块不得绕过 `src/contracts` 定义的新公共服务边界。跨模块类型只从 `src/contracts` 导入。

## 数据模型

### Conversation

每个角色至少一条主会话。当前版本一个角色对应一条会话，保留 `conversationId` 以便未来扩展多会话。

### Memory

```ts
{
  id, personaId, kind, title, content, source,
  confidence, createdAt, updatedAt, lastRecalledAt?, tags
}
```

- 自动提取的记忆必须 `source: 'inferred'` 且有 `confidence`。
- 用户编辑后的记忆改为 `source: 'user'`。
- 召回只允许同 `personaId`。
- 删除必须同步移除关联消息中的 `memoryIds`。

### AlbumPhoto

只允许来自同角色、同消息的图片。相册是情感资产视图，不制造付费解锁门槛。

## 对话链路

```text
用户消息
  -> SafetyEngine.assess
  -> EmotionEngine.analyze
  -> MemoryEngine.rankRelevant
  -> PromptCompiler(persona + memories + strategy)
  -> ChatProvider.stream
  -> 增量写入消息流
  -> MemoryEngine.extract
  -> ScenarioImageService.trigger（异步，不阻塞文字回复）
  -> 持久化
```

结构化分析失败时：

1. 降级为普通安抚策略；
2. 不触发生图和音乐；
3. 记录可读错误状态，不破坏已有对话。

## Provider 策略

### demo

- 纯前端、无需密钥。
- 使用人设语气模板、场景 opener、记忆引用和策略组合生成回复。
- 支持逐字流式展示，允许取消。
- 不伪装成真实大模型输出。

### openai-compatible

- `POST {baseUrl}/chat/completions`
- `Authorization: Bearer {apiKey}`
- `stream: true`
- 解析 SSE `data:` 行，支持 `[DONE]`。
- 错误统一映射为中文可理解提示。
- 不把 Key 写入日志、导出文件或错误信息。

## 存储

- IndexedDB database：`mira-companion`
- object store：`state`
- key：`app-state-v1`
- schema 版本写入 `AppState` 外部单独 meta 对象，或由 repository 维护 `version`。
- 每次状态变更使用短延迟批量写入，避免流式 token 高频落盘。
- 导出：JSON 文件，包含版本、时间、全部状态，不包含明文 API Key。

## 音频

氛围音使用 Web Audio API 合成柔和 pad，不依赖外部音频文件。必须在用户手势后初始化 `AudioContext`，页面隐藏时 suspend。

## 部署

GitHub Actions：

1. checkout
2. setup Node 22 + pnpm
3. install
4. `pnpm check`
5. upload `dist`
6. deploy GitHub Pages

Vite `base` 由 `VITE_BASE_PATH` 控制，默认 `./`，可适配仓库子路径。

# Mira 内部接口契约

冻结类型位于 `src/contracts/domain.ts` 与 `src/contracts/services.ts`。以下接口不得被各个 worker 私自改名或改变语义。

## EmotionEngine

```ts
analyze(input: string, persona: Persona, memories: Memory[]): EmotionReading
```

- 必须始终返回全部字段。
- `intensity` 范围 0–1。
- `shouldGenerateImage` 仅在语境合理且非 urgent safety 时为 true。
- `rationale` 用于评测和调试，不直接展示给用户。

## SafetyEngine

```ts
assess(input: string, history: ChatMessage[]): SafetyDecision
buildSafetyReply(decision: SafetyDecision, persona: Persona): string
shouldShowDependencyReminder(sessionStartedAt: string, now?: Date): boolean
```

- `urgent` 优先级高于所有产品策略。
- urgent 时不得调用图片服务。
- 回复必须引导现实世界紧急援助，不能继续沉浸式恋爱表达。

## MemoryEngine

```ts
extract(input: string, personaId: PersonaId): CandidateMemory[]
rankRelevant(memories: Memory[], input: string, limit?: number): Memory[]
```

- `extract` 只识别明确表达或高置信偏好，避免把短暂情绪写成永久事实。
- `rankRelevant` 只返回同 persona 记忆。
- 默认 limit 为 6。

## ChatProvider

```ts
stream(input: ProviderChatInput, signal: AbortSignal): AsyncIterable<ChatChunk>
```

- 通过 `text-delta` 增量输出，最终必须发出 `done`。
- 取消时停止请求并优雅结束，不抛未处理错误。
- 错误必须转为 `{ type: 'error', error: string }`。

## StorageRepository

```ts
loadState(): Promise<AppState>
saveState(state: AppState): Promise<void>
clear(): Promise<void>
```

- 首次加载返回完整可用的默认状态。
- 损坏数据自动恢复默认状态，不阻塞应用启动。
- 不在导出文件中包含明文 API Key。

## ScenarioImageService

```ts
trigger(reading, persona, latestUserMessage): Promise<{ imageUrl, caption }>
```

- 必须模拟真实异步延迟，但不阻塞文字流。
- 每个 `personaId + scene` 至少映射一个稳定照片。
- 图片和 caption 不得暗示真人照片或外部真实身份。

## Provider HTTP

OpenAI 兼容请求：

```http
POST {baseUrl}/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "...",
  "temperature": 0.8,
  "stream": true,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

系统提示必须包含：

- 角色人格与语气
- 当前场景、情绪、策略
- 相关长期记忆
- 一组明确的边界：不冒充真人、不提供医疗诊断、不鼓励切断现实关系

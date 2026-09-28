import { z } from 'zod';
import type {
  AppController, AppState, ChatMessage, ChatProvider, EmotionEngine, EmotionReading, Memory,
  MemoryEngine, PersonaId, ProviderConfig, SafetyEngine, ScenarioImageService, StorageRepository
} from '../contracts';
import { createStorageRepository } from '../core/storage';
import { createEmotionEngine } from '../core/emotion';
import { createMemoryEngine } from '../core/memory';
import { createSafetyEngine } from '../core/safety';
import { createScenarioImageService } from '../core/images';
import { createChatProvider } from '../core/providers';
import { getPersona } from '../core/personas';
import { createDefaultState } from './defaultState';

const personaSchema = z.enum(['shenxu', 'jiangye', 'linche']);
const identifier = z.string().min(1).max(160).refine(value => !['__proto__', 'prototype', 'constructor'].includes(value));
const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const shortText = z.string().max(500);
const imageUrl = z.string().max(2000).refine(value => {
  if (!value.trim() || /[\s\\]/.test(value) || value.startsWith('//')) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return /^https?:\/\//i.test(value);
  return !value.startsWith('#');
});
const sceneSchema = z.enum(['late_night', 'work_stress', 'relationship', 'daily_share', 'celebration', 'conflict', 'loneliness', 'crisis']);
const emotionSchema = z.enum(['calm', 'sad', 'anxious', 'angry', 'lonely', 'happy', 'tired', 'crisis']);
const readingSchema = z.object({
  scene: sceneSchema, emotion: emotionSchema, intensity: z.number().finite(),
  strategy: z.enum(['listen', 'comfort', 'validate', 'gently_reframe', 'celebrate', 'set_boundary', 'safety_redirect']),
  shouldGenerateImage: z.boolean(), shouldOfferMusic: z.boolean(), imagePrompt: z.string().optional(), rationale: z.string(),
  safety: z.object({ level: z.enum(['none', 'watch', 'urgent']), reason: z.string(), userMessage: z.string().optional() })
});
const memorySchema = z.object({
  id: identifier, personaId: personaSchema, kind: z.enum(['preference', 'event', 'relationship', 'boundary', 'goal']),
  title: shortText, content: z.string().min(1).max(4000), source: z.enum(['user', 'inferred', 'imported']),
  confidence: z.number().min(0).max(1), createdAt: timestamp, updatedAt: timestamp,
  lastRecalledAt: timestamp.optional(), tags: z.array(z.string().max(100)).max(30)
});
const providerSchema = z.object({
  mode: z.enum(['demo', 'openai-compatible']), baseUrl: z.string().max(2000), apiKey: z.string().max(4000).default(''),
  model: z.string().max(300), temperature: z.number().min(0).max(2), rememberKey: z.boolean()
});
const settingsSchema = z.object({
  provider: providerSchema, ambientAudio: z.boolean(), reducedMotion: z.boolean(), dependencyReminder: z.boolean(), theme: z.enum(['night', 'dawn'])
});
const stateSchema = z.object({
  activePersonaId: personaSchema, onboardingComplete: z.boolean(), settings: settingsSchema,
  conversations: z.array(z.object({ id: identifier, personaId: personaSchema, title: shortText, createdAt: timestamp,
    updatedAt: timestamp, messageCount: z.number().int().nonnegative(), lastMessagePreview: shortText, unreadCount: z.number().int().nonnegative() })).max(3),
  messages: z.record(identifier, z.array(z.object({
    id: identifier, conversationId: identifier, role: z.enum(['user', 'assistant', 'system']), kind: z.enum(['text', 'selfie', 'voice_note', 'system']),
    text: z.string().max(200000), createdAt: timestamp, status: z.enum(['sending', 'streaming', 'sent', 'failed']),
    imageUrl: imageUrl.optional(), imageCaption: shortText.optional(), emotion: emotionSchema.optional(), memoryIds: z.array(identifier).max(100).optional()
  })).max(100000)),
  memories: z.array(memorySchema).max(20000),
  album: z.array(z.object({ id: identifier, personaId: personaSchema, messageId: identifier, imageUrl, caption: shortText,
    scene: sceneSchema, createdAt: timestamp, favorite: z.boolean() })).max(20000)
});

function validateState(value: unknown): AppState {
  const state = stateSchema.parse(value);
  const conversationIds = new Set(state.conversations.map(conversation => conversation.id));
  if (conversationIds.size !== state.conversations.length || new Set(state.conversations.map(conversation => conversation.personaId)).size !== state.conversations.length) throw new Error('会话重复');
  if (Object.keys(state.messages).some(id => !conversationIds.has(id))) throw new Error('会话关联无效');
  const memories = new Map(state.memories.map(memory => [memory.id, memory]));
  if (memories.size !== state.memories.length) throw new Error('记忆重复');
  const messageIds = new Set<string>();
  for (const conversation of state.conversations) {
    const messages = state.messages[conversation.id] ?? [];
    for (const message of messages) {
      if (messageIds.has(message.id) || message.conversationId !== conversation.id) throw new Error('消息关联无效');
      messageIds.add(message.id);
      if (message.memoryIds?.some(id => memories.get(id)?.personaId !== conversation.personaId)) throw new Error('记忆关联无效');
    }
    state.messages[conversation.id] = messages;
    conversation.messageCount = messages.length;
    conversation.lastMessagePreview = messages.at(-1)?.text.slice(0, 100) ?? '';
  }
  const photoIds = new Set<string>();
  const photoMessages = new Set<string>();
  for (const photo of state.album) {
    const conversation = state.conversations.find(item => item.personaId === photo.personaId);
    const message = conversation && state.messages[conversation.id]?.find(item => item.id === photo.messageId);
    if (photoIds.has(photo.id) || photoMessages.has(photo.messageId) || message?.kind !== 'selfie' || message.role !== 'assistant' || message.imageUrl !== photo.imageUrl) throw new Error('相册关联无效');
    photoIds.add(photo.id); photoMessages.add(photo.messageId);
  }
  return state;
}

function safeProvider(config: ProviderConfig): ProviderConfig {
  const parsed = providerSchema.parse(config);
  const url = parsed.baseUrl.trim();
  if (url) {
    let endpoint: URL;
    try { endpoint = new URL(url); } catch { throw new Error('请输入有效的 API 服务地址。'); }
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('API 地址只应包含服务路径，请勿包含密钥、查询参数或账号密码。');
  }
  return { ...parsed, baseUrl: url, model: parsed.model.trim(), apiKey: parsed.apiKey.trim() };
}

/** Optional dependencies preserve the AppController contract and make safety routing testable. */
export function createCompanionController(dependencies: {
  storage?: StorageRepository;
  emotion?: EmotionEngine;
  memory?: MemoryEngine;
  safety?: SafetyEngine;
  images?: ScenarioImageService;
  providerFactory?: (config: ProviderConfig) => ChatProvider;
} = {}): AppController {
  let state = createDefaultState();
  const storage = dependencies.storage ?? createStorageRepository();
  const emotion = dependencies.emotion ?? createEmotionEngine();
  const memory = dependencies.memory ?? createMemoryEngine();
  const safety = dependencies.safety ?? createSafetyEngine();
  const images = dependencies.images ?? createScenarioImageService();
  const providerFactory = dependencies.providerFactory ?? createChatProvider;
  const sessionStartedAt = new Date().toISOString();
  let reminderShown = false;
  let initialized: Promise<void> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let writes: Promise<void> = Promise.resolve();
  let activeTurn: { abort: AbortController; conversationId: string; messageId: string } | undefined;
  const pending = new Set<AbortController>();
  let storageWarningShown = false;
  let revision = 0;
  const now = () => new Date().toISOString();
  const id = () => crypto.randomUUID();
  const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('mira:statechange')); };
  const persist = (): Promise<void> => {
    clearTimeout(saveTimer); saveTimer = undefined;
    const snapshot = structuredClone(state);
    writes = writes.catch(() => undefined).then(() => storage.saveState(snapshot));
    return writes.catch(() => { throw new Error('本地保存失败，请检查浏览器存储空间；可先导出数据备份。'); });
  };
  const changed = (next: AppState) => {
    state = next;
    notify();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void persist().catch(showStorageWarning); }, 180);
  };
  function updateMessages(conversationId: string, messages: ChatMessage[], additional: Partial<AppState> = {}) {
    changed({ ...state, ...additional, messages: { ...state.messages, [conversationId]: messages }, conversations: state.conversations.map(conversation => conversation.id === conversationId ? {
      ...conversation, messageCount: messages.length, lastMessagePreview: messages.at(-1)?.text.slice(0, 100) ?? '', updatedAt: now(),
      unreadCount: conversation.personaId === state.activePersonaId ? 0 : conversation.unreadCount
    } : conversation) });
  }
  function append(conversationId: string, message: ChatMessage) { updateMessages(conversationId, [...(state.messages[conversationId] ?? []), message]); }
  function patchMessage(conversationId: string, messageId: string, patch: Partial<ChatMessage>) {
    if (!state.messages[conversationId]?.some(message => message.id === messageId)) return;
    updateMessages(conversationId, state.messages[conversationId].map(message => message.id === messageId ? { ...message, ...patch } : message));
  }
  function systemMessage(conversationId: string, text: string) {
    append(conversationId, { id: id(), conversationId, role: 'system', kind: 'system', text, createdAt: now(), status: 'sent' });
  }
  function showStorageWarning() {
    if (storageWarningShown) return;
    storageWarningShown = true;
    const conversation = state.conversations.find(item => item.personaId === state.activePersonaId);
    if (conversation) systemMessage(conversation.id, '本地保存暂时失败，请检查浏览器存储空间；当前内容仍在页面中，可以先导出备份。');
  }
  function ensureConversation(personaId: PersonaId) {
    const existing = state.conversations.find(conversation => conversation.personaId === personaId);
    if (existing) return existing;
    const persona = getPersona(personaId);
    const createdAt = now();
    const conversation = { id: id(), personaId, title: `与${persona.name}的对话`, createdAt, updatedAt: createdAt, messageCount: 1, lastMessagePreview: persona.greeting.slice(0, 100), unreadCount: 0 };
    const greeting: ChatMessage = { id: id(), conversationId: conversation.id, role: 'assistant', kind: 'text', text: persona.greeting, createdAt, status: 'sent' };
    changed({ ...state, conversations: [...state.conversations, conversation], messages: { ...state.messages, [conversation.id]: [greeting] } });
    return conversation;
  }
  function stopStreaming() {
    for (const job of pending) job.abort();
    pending.clear();
    if (activeTurn) {
      activeTurn.abort.abort();
      const message = state.messages[activeTurn.conversationId]?.find(item => item.id === activeTurn?.messageId);
      if (message?.status === 'streaming') patchMessage(message.conversationId, message.id, { status: message.text ? 'sent' : 'failed', text: message.text || '已停止生成。' });
      activeTurn = undefined;
    }
  }
  function extractMemories(text: string, personaId: PersonaId, conversationId: string, sourceMessageId: string) {
    const candidates = memory.extract(text, personaId);
    const memoryIds: string[] = [];
    const next = [...state.memories];
    for (const candidate of candidates) {
      if (!candidate.content.trim() || candidate.confidence < .8 || candidate.confidence > 1) continue;
      const existing = next.find(item => item.personaId === personaId && item.kind === candidate.kind && item.content === candidate.content);
      if (existing) { memoryIds.push(existing.id); continue; }
      const stamp = now();
      const created = memorySchema.parse({ ...candidate, id: id(), personaId, source: 'inferred', createdAt: stamp, updatedAt: stamp });
      next.push(created); memoryIds.push(created.id);
    }
    if (memoryIds.length) {
      changed({ ...state, memories: next });
      patchMessage(conversationId, sourceMessageId, { memoryIds });
    }
  }
  function queueImage(reading: EmotionReading, personaId: PersonaId, text: string, conversationId: string, abort: AbortController) {
    if (abort.signal.aborted || reading.safety.level === 'urgent') return;
    pending.add(abort);
    void Promise.resolve().then(() => abort.signal.aborted ? undefined : images.trigger(reading, getPersona(personaId), text)).then(result => {
      if (!result || abort.signal.aborted || !state.conversations.some(conversation => conversation.id === conversationId && conversation.personaId === personaId)) return;
      if (!imageUrl.safeParse(result.imageUrl).success || !result.caption?.trim()) throw new Error('Invalid image');
      const createdAt = now();
      const message: ChatMessage = { id: id(), conversationId, role: 'assistant', kind: 'selfie', text: result.caption.slice(0, 500), imageCaption: result.caption.slice(0, 500), imageUrl: result.imageUrl, createdAt, status: 'sent' };
      updateMessages(conversationId, [...state.messages[conversationId], message], { album: [...state.album, { id: id(), personaId, messageId: message.id, imageUrl: result.imageUrl, caption: message.text, scene: reading.scene, createdAt, favorite: false }] });
      return persist();
    }).catch(() => {
      if (!abort.signal.aborted && state.messages[conversationId]) systemMessage(conversationId, '这次角色场景图没能准备好，文字对话不受影响。');
    }).finally(() => pending.delete(abort));
  }

  const controller: AppController = {
    initialize() {
      initialized ??= (async () => {
        const loadRevision = revision;
        let loaded: AppState;
        try { loaded = validateState(await storage.loadState()); loaded.settings.provider = safeProvider(loaded.settings.provider); }
        catch { loaded = createDefaultState(); }
        if (loadRevision !== revision) return;
        for (const messages of Object.values(loaded.messages)) {
          for (const message of messages) if (message.status === 'sending' || message.status === 'streaming') {
            message.status = message.text ? 'sent' : 'failed'; message.text ||= '上次生成已中断，可以重新发送。';
          }
        }
        changed(loaded);
        ensureConversation(state.activePersonaId);
        await persist().catch(showStorageWarning);
      })();
      return initialized;
    },
    getState: () => state,
    async selectPersona(personaId) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      if (!personaSchema.safeParse(personaId).success) throw new Error('未找到这个角色。');
      if (personaId !== state.activePersonaId) stopStreaming();
      ensureConversation(personaId);
      changed({ ...state, activePersonaId: personaId, onboardingComplete: true, conversations: state.conversations.map(conversation => conversation.personaId === personaId ? { ...conversation, unreadCount: 0 } : conversation) });
      await persist();
    },
    async sendMessage(rawText) {
      const text = rawText.trim();
      if (!text) return;
      if (text.length > 12000) throw new Error('这条消息有点长，请分成几段发送（每段最多 12000 字）。');
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision || activeTurn) return;
      const personaId = state.activePersonaId;
      const persona = getPersona(personaId);
      const conversation = ensureConversation(personaId);
      const conversationId = conversation.id;
      const userMessage: ChatMessage = { id: id(), conversationId, role: 'user', kind: 'text', text, createdAt: now(), status: 'sent' };
      append(conversationId, userMessage);
      const abort = new AbortController();
      const assistant: ChatMessage = { id: id(), conversationId, role: 'assistant', kind: 'text', text: '', createdAt: now(), status: 'streaming' };
      activeTurn = { abort, conversationId, messageId: assistant.id };
      pending.add(abort);
      append(conversationId, assistant);
      let imageQueued = false;
      try {
        const history = state.messages[conversationId].filter(message => message.id !== assistant.id);
        // Safety runs first. A failing safety dependency never falls through to an unchecked provider.
        const decision = safety.assess(text, history);
        if (decision.level === 'urgent') {
          for (const job of pending) if (job !== abort) { job.abort(); pending.delete(job); }
          patchMessage(conversationId, userMessage.id, { emotion: 'crisis' });
          patchMessage(conversationId, assistant.id, { text: safety.buildSafetyReply(decision, persona), emotion: 'crisis', status: 'sent' });
          return;
        }
        const scoped = state.memories.filter(item => item.personaId === personaId);
        let reading: EmotionReading;
        try {
          reading = readingSchema.parse(emotion.analyze(text, persona, scoped));
          reading = { ...reading, intensity: Math.max(0, Math.min(1, reading.intensity)), safety: reading.safety.level === 'urgent' ? reading.safety : decision };
        } catch {
          reading = { scene: 'daily_share', emotion: 'calm', intensity: .3, strategy: 'comfort', shouldGenerateImage: false, shouldOfferMusic: false, safety: decision, rationale: '本地分析暂不可用，采用普通安抚策略' };
          systemMessage(conversationId, '这次情绪分析暂不可用，会继续文字陪伴。');
        }
        if (reading.safety.level === 'urgent') {
          for (const job of pending) if (job !== abort) { job.abort(); pending.delete(job); }
          patchMessage(conversationId, userMessage.id, { emotion: 'crisis' });
          patchMessage(conversationId, assistant.id, { text: safety.buildSafetyReply(reading.safety, persona), emotion: 'crisis', status: 'sent' });
          return;
        }
        const relevant = memory.rankRelevant(scoped, text, 6).filter(item => item.personaId === personaId && scoped.some(known => known.id === item.id)).slice(0, 6);
        const recalledIds = new Set(relevant.map(item => item.id));
        if (recalledIds.size) changed({ ...state, memories: state.memories.map(item => recalledIds.has(item.id) ? { ...item, lastRecalledAt: now() } : item) });
        patchMessage(conversationId, userMessage.id, { emotion: reading.emotion });
        patchMessage(conversationId, assistant.id, { emotion: reading.emotion, memoryIds: [...recalledIds] });
        const provider = providerFactory({ ...state.settings.provider });
        let answer = '';
        let failed = false;
        for await (const chunk of provider.stream({ persona, history, memories: relevant, reading, userMessage: text }, abort.signal)) {
          if (abort.signal.aborted) break;
          if (chunk.type === 'error') {
            failed = true;
            const key = state.settings.provider.apiKey;
            const supplied = chunk.error?.slice(0, 500) || '回复暂时未能完成，请稍后重试。';
            const error = key ? supplied.split(key).join('[已隐藏密钥]') : supplied;
            patchMessage(conversationId, assistant.id, { text: answer ? `${answer}\n\n${error}` : error, status: 'failed' });
            break;
          }
          if (chunk.type === 'done') break;
          if (chunk.type === 'text-delta' && chunk.delta) {
            answer += chunk.delta;
            if (answer.length > 100000) { failed = true; patchMessage(conversationId, assistant.id, { text: `${answer.slice(0, 100000)}\n\n回复已达到长度上限。`, status: 'failed' }); break; }
            patchMessage(conversationId, assistant.id, { text: answer });
          }
        }
        if (!abort.signal.aborted && !failed) patchMessage(conversationId, assistant.id, { text: answer || '这次没有收到回复，请重试。', status: answer ? 'sent' : 'failed' });
        if (!abort.signal.aborted) {
          try { extractMemories(text, personaId, conversationId, userMessage.id); }
          catch { systemMessage(conversationId, '这次记忆整理未完成，原始消息仍已保留。'); }
          if (!failed && answer && reading.shouldGenerateImage) {
            imageQueued = true; queueImage(reading, personaId, text, conversationId, abort);
          }
          if (state.settings.dependencyReminder && !reminderShown && safety.shouldShowDependencyReminder(sessionStartedAt)) {
            reminderShown = true; systemMessage(conversationId, '已经聊了一会儿。可以休息一下、喝点水，或和现实中信任的人打个招呼；这里的 AI 陪伴只是生活的一部分。');
          }
        }
      } catch {
        if (!abort.signal.aborted) patchMessage(conversationId, assistant.id, { text: '这次回复未能完成，请稍后重试。你已发送的消息会保留。', status: 'failed' });
      } finally {
        if (activeTurn?.abort === abort) activeTurn = undefined;
        if (!imageQueued) pending.delete(abort);
        await persist().catch(showStorageWarning);
      }
    },
    stopStreaming,
    async updateProvider(config) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      const provider = safeProvider(config);
      stopStreaming();
      changed({ ...state, settings: { ...state.settings, provider } });
      await persist();
    },
    async updateSettings(partial) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      const settings = settingsSchema.parse({ ...state.settings, ...partial, provider: partial.provider ? safeProvider(partial.provider) : state.settings.provider });
      if (partial.provider) stopStreaming();
      changed({ ...state, settings });
      await persist();
    },
    async deleteMemory(memoryId) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      const target = state.memories.find(item => item.id === memoryId && item.personaId === state.activePersonaId);
      if (!target) return;
      changed({ ...state, memories: state.memories.filter(item => item.id !== target.id), messages: Object.fromEntries(Object.entries(state.messages).map(([conversationId, messages]) => [conversationId, messages.map(message => ({ ...message, memoryIds: message.memoryIds?.filter(id => id !== target.id) }))])) });
      await persist();
    },
    async updateMemory(memoryId, patch: Partial<Memory>) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      const target = state.memories.find(item => item.id === memoryId && item.personaId === state.activePersonaId);
      if (!target) return;
      const updated = memorySchema.parse({ ...target, title: patch.title ?? target.title, content: patch.content?.trim() ?? target.content,
        kind: patch.kind ?? target.kind, tags: patch.tags ?? target.tags, source: 'user', confidence: 1, updatedAt: now() });
      changed({ ...state, memories: state.memories.map(item => item.id === target.id ? updated : item) });
      await persist();
    },
    async favoritePhoto(photoId) {
      const operationRevision = revision;
      await controller.initialize();
      if (operationRevision !== revision) return;
      changed({ ...state, album: state.album.map(photo => photo.id === photoId && photo.personaId === state.activePersonaId ? { ...photo, favorite: !photo.favorite } : photo) });
      await persist();
    },
    async exportData() {
      await controller.initialize();
      const snapshot = structuredClone(state);
      const { apiKey, ...provider } = snapshot.settings.provider;
      // Even a key accidentally repeated in message text is removed from this export.
      let json = JSON.stringify({ version: 1, exportedAt: now(), state: { ...snapshot, settings: { ...snapshot.settings, provider: { ...provider, rememberKey: false } } } }, null, 2);
      if (apiKey) json = json.split(JSON.stringify(apiKey).slice(1, -1)).join('[已隐藏密钥]');
      return new Blob([json], { type: 'application/json' });
    },
    async importData(file) {
      const operationRevision = revision;
      if (file.size > 20 * 1024 * 1024) throw new Error('备份文件过大，请选择 20 MB 以内的 Mira JSON 备份。');
      let imported: AppState;
      try {
        const data: unknown = JSON.parse(await file.text());
        const envelope = z.object({ version: z.literal(1), state: z.unknown() }).parse(data);
        imported = validateState(envelope.state);
        imported.settings.provider = safeProvider({ ...imported.settings.provider, apiKey: '', rememberKey: false });
        for (const messages of Object.values(imported.messages)) for (const message of messages) {
          if (message.status === 'sending' || message.status === 'streaming') { message.status = message.text ? 'sent' : 'failed'; message.text ||= '导入的未完成回复已停止。'; }
        }
      } catch { throw new Error('备份格式无效、版本不支持或角色数据关联错误。现有数据未被更改。'); }
      if (operationRevision !== revision) throw new Error('数据已发生变化，本次导入已取消；请重新选择备份。');
      stopStreaming(); revision++;
      changed(imported);
      initialized = Promise.resolve();
      ensureConversation(state.activePersonaId);
      await persist();
    },
    async resetAllData() {
      stopStreaming(); revision++;
      clearTimeout(saveTimer);
      // Replace in-memory state before yielding, and serialize clear with every write.
      // A late cancelled turn may still finalize, but can only snapshot this fresh state.
      state = createDefaultState();
      notify();
      writes = writes.catch(() => undefined).then(() => storage.clear());
      initialized = writes.catch(() => { throw new Error('本地数据清空失败，请检查浏览器存储权限。'); });
      await initialized;
      reminderShown = false; storageWarningShown = false;
      ensureConversation(state.activePersonaId);
      await persist();
    },
    getAlbum: personaId => state.album.filter(photo => photo.personaId === personaId)
  };
  return controller;
}

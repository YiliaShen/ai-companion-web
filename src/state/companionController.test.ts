import { describe, expect, it, vi } from 'vitest';
import type { AppState, ChatChunk, ChatProvider, ProviderChatInput, SafetyEngine, StorageRepository } from '../contracts';
import { createDefaultState } from './defaultState';
import { createCompanionController } from './companionController';
import { buildDemoReply } from '../core/providers';

function repository(initial = createDefaultState()): StorageRepository & { snapshot(): AppState } {
  let saved = structuredClone(initial);
  return { loadState: async () => structuredClone(saved), saveState: async state => { saved = structuredClone(state); }, clear: async () => { saved = createDefaultState(); }, snapshot: () => saved };
}
const safety: SafetyEngine = { assess: () => ({ level: 'none', reason: '' }), buildSafetyReply: () => '请联系现实中的紧急援助。', shouldShowDependencyReminder: () => false };
function setup(extra: Parameters<typeof createCompanionController>[0] = {}) {
  const inputs: ProviderChatInput[] = [];
  const storage = repository();
  const provider: ChatProvider = { id: 'demo', async *stream(input) { inputs.push(input); yield { type: 'text-delta', delta: buildDemoReply(input) }; yield { type: 'done' }; } };
  const controller = createCompanionController({ storage, safety, providerFactory: () => provider, ...extra });
  return { controller, storage, inputs };
}
const userTexts = (state: AppState, personaId: AppState['activePersonaId']) => {
  const conversation = state.conversations.find(item => item.personaId === personaId);
  return conversation ? state.messages[conversation.id].filter(message => message.role === 'user').map(message => message.text) : [];
};

describe('conversation controller', () => {
  it('creates one conversation per persona and isolates history, recall and mutations', async () => {
    const { controller, inputs, storage } = setup();
    await controller.initialize();
    await controller.selectPersona('shenxu');
    await controller.sendMessage('我喜欢乌龙茶。');
    const firstMemory = controller.getState().memories[0];
    expect(firstMemory).toMatchObject({ personaId: 'shenxu', source: 'inferred' });
    await controller.selectPersona('jiangye');
    await controller.sendMessage('你记得我吗？');
    expect(inputs.at(-1)?.memories).toEqual([]);
    expect(inputs.at(-1)?.history.some(message => message.text.includes('乌龙茶'))).toBe(false);
    await controller.updateMemory(firstMemory.id, { content: '跨角色篡改' });
    await controller.deleteMemory(firstMemory.id);
    expect(controller.getState().memories[0].content).toBe('我喜欢乌龙茶');
    await controller.selectPersona('shenxu');
    await controller.sendMessage('还记得乌龙茶吗？');
    expect(inputs.at(-1)?.memories[0].id).toBe(firstMemory.id);
    expect(controller.getState().conversations).toHaveLength(2);
    expect(userTexts(controller.getState(), 'jiangye')).toEqual(['你记得我吗？']);
    expect(storage.snapshot().onboardingComplete).toBe(true);
  });
  it('honors injected urgent safety before analysis, provider, memory or images', async () => {
    const analyze = vi.fn(); const providerFactory = vi.fn(); const extract = vi.fn(); const trigger = vi.fn();
    const assess = vi.fn(() => ({ level: 'urgent' as const, reason: 'injected critical decision' }));
    const { controller } = setup({ safety: { ...safety, assess }, emotion: { analyze }, providerFactory, memory: { extract, rankRelevant: vi.fn() }, images: { trigger } });
    await controller.sendMessage('想看看你，现在需要帮助。');
    const message = Object.values(controller.getState().messages)[0].at(-1);
    expect(message).toMatchObject({ text: '请联系现实中的紧急援助。', status: 'sent', emotion: 'crisis' });
    expect(assess).toHaveBeenCalledOnce();
    for (const dependency of [analyze, providerFactory, extract, trigger]) expect(dependency).not.toHaveBeenCalled();
  });
  it('falls back to safe text analysis with a readable status and no images', async () => {
    const trigger = vi.fn();
    const { controller, inputs } = setup({ emotion: { analyze() { throw new Error('internal'); } }, images: { trigger } });
    await controller.sendMessage('想看看你。');
    expect(inputs[0].reading).toMatchObject({ strategy: 'comfort', shouldGenerateImage: false });
    expect(Object.values(controller.getState().messages)[0].some(message => message.kind === 'system' && message.text.includes('分析暂不可用'))).toBe(true);
    expect(trigger).not.toHaveBeenCalled();
  });
  it('streams before asynchronous images, then links image and album atomically by persona', async () => {
    let resolveImage!: (result: { imageUrl: string; caption: string }) => void;
    const { controller } = setup({ images: { trigger: () => new Promise(resolve => { resolveImage = resolve; }) } });
    await controller.sendMessage('想看看你，发张海边照片吧。');
    expect(controller.getAlbum('shenxu')).toEqual([]);
    expect(Object.values(controller.getState().messages)[0].at(-1)?.status).toBe('sent');
    resolveImage({ imageUrl: './assets/personas/shenxu-hero.jpg', caption: '海边的角色场景插画' });
    await vi.waitFor(() => expect(controller.getAlbum('shenxu')).toHaveLength(1));
    const photo = controller.getAlbum('shenxu')[0];
    expect(Object.values(controller.getState().messages)[0].find(message => message.id === photo.messageId)?.imageUrl).toBe(photo.imageUrl);
    await controller.favoritePhoto(photo.id);
    expect(controller.getAlbum('shenxu')[0].favorite).toBe(true);
    expect(controller.getAlbum('jiangye')).toEqual([]);
  });
  it('switching personas stops streaming and suppresses late chunks', async () => {
    let unblock!: () => void;
    const gate = new Promise<void>(resolve => { unblock = resolve; });
    const provider: ChatProvider = { id: 'demo', async *stream(): AsyncIterable<ChatChunk> { yield { type: 'text-delta', delta: '已经收到的部分' }; await gate; yield { type: 'text-delta', delta: '不应该出现的部分' }; yield { type: 'done' }; } };
    const { controller } = setup({ providerFactory: () => provider });
    const sending = controller.sendMessage('你好');
    await vi.waitFor(() => expect(Object.values(controller.getState().messages)[0]?.at(-1)?.text).toBe('已经收到的部分'));
    await controller.selectPersona('linche');
    unblock(); await sending;
    expect(JSON.stringify(controller.getState())).not.toContain('不应该出现的部分');
    expect(userTexts(controller.getState(), 'linche')).toEqual([]);
    expect(Object.values(controller.getState().messages).flat().some(message => message.status === 'streaming')).toBe(false);
  });
  it('reset aborts delayed images and does not resurrect messages or old preferences', async () => {
    let resolveImage!: (result: { imageUrl: string; caption: string }) => void;
    const { controller, storage } = setup({ images: { trigger: () => new Promise(resolve => { resolveImage = resolve; }) } });
    await controller.sendMessage('想看看你');
    await controller.resetAllData();
    resolveImage({ imageUrl: './old.jpg', caption: '旧照片' });
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().album).toEqual([]);
    expect(userTexts(controller.getState(), 'shenxu')).toEqual([]);
    expect(storage.snapshot().onboardingComplete).toBe(false);
  });
  it('reset prevents actions waiting on initial load from restoring old messages or keys', async () => {
    let resolveLoad!: (state: AppState) => void;
    const storage = repository();
    const controller = createCompanionController({ storage: { ...storage, loadState: () => new Promise(resolve => { resolveLoad = resolve; }) } });
    const send = controller.sendMessage('清空前等待加载的消息');
    const update = controller.updateProvider({ ...createDefaultState().settings.provider, apiKey: 'old-secret' });
    await controller.resetAllData();
    resolveLoad(createDefaultState());
    await Promise.all([send, update]);
    expect(userTexts(controller.getState(), 'shenxu')).toEqual([]);
    expect(controller.getState().settings.provider.apiKey).toBe('');
    expect(storage.snapshot().settings.provider.apiKey).toBe('');
  });
  it('reset cancels a backup that is still being read', async () => {
    const { controller } = setup();
    await controller.sendMessage('我喜欢咖啡');
    const backup = await (await controller.exportData()).text();
    let resolveRead!: (text: string) => void;
    const file = new File([backup], 'backup.json');
    Object.defineProperty(file, 'text', { value: () => new Promise<string>(resolve => { resolveRead = resolve; }) });
    const importing = controller.importData(file);
    await controller.resetAllData();
    resolveRead(backup);
    await expect(importing).rejects.toThrow('本次导入已取消');
    expect(controller.getState().memories).toEqual([]);
  });
  it('urgent safety cancels previously queued image work', async () => {
    let resolveImage!: (result: { imageUrl: string; caption: string }) => void;
    const trigger = vi.fn(() => new Promise<{ imageUrl: string; caption: string }>(resolve => { resolveImage = resolve; }));
    const { controller } = setup({ images: { trigger }, safety: { ...safety, assess: text => ({ level: text.includes('危机') ? 'urgent' : 'none', reason: 'test' }) } });
    await controller.sendMessage('想看看你');
    await controller.sendMessage('现在有危机');
    resolveImage({ imageUrl: './old.jpg', caption: '不应在危机期间出现' });
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().album).toEqual([]);
    expect(trigger).toHaveBeenCalledOnce();
  });
  it('edits only safe memory fields and deletes all source/recall references', async () => {
    const { controller } = setup();
    await controller.sendMessage('我喜欢咖啡。');
    const original = controller.getState().memories[0];
    await controller.updateMemory(original.id, { content: '我喜欢乌龙茶', id: 'injected', personaId: 'jiangye' });
    expect(controller.getState().memories[0]).toMatchObject({ id: original.id, personaId: 'shenxu', content: '我喜欢乌龙茶', source: 'user', confidence: 1 });
    await controller.sendMessage('乌龙茶');
    await controller.deleteMemory(original.id);
    expect(controller.getState().memories).toEqual([]);
    expect(Object.values(controller.getState().messages).flat().every(message => !message.memoryIds?.includes(original.id))).toBe(true);
  });
  it('exports no API key, imports valid data, and rejects cross-persona references without mutation', async () => {
    const { controller } = setup();
    await controller.sendMessage('我喜欢咖啡');
    await controller.updateProvider({ ...controller.getState().settings.provider, apiKey: 'private-key-example', rememberKey: true });
    const exported = await (await controller.exportData()).text();
    expect(exported).not.toContain('private-key-example');
    expect(exported).not.toContain('"apiKey"');
    const target = setup().controller;
    await target.importData(new File([exported], 'backup.json'));
    expect(target.getState().memories[0].content).toBe('我喜欢咖啡');
    expect(target.getState().settings.provider).toMatchObject({ apiKey: '', rememberKey: false });
    const before = structuredClone(target.getState());
    const broken = JSON.parse(exported);
    broken.state.memories[0].personaId = 'linche';
    await expect(target.importData(new File([JSON.stringify(broken)], 'bad.json'))).rejects.toThrow('角色数据关联错误');
    expect(target.getState()).toEqual(before);
    await expect(target.importData(new File(['{"version":900}'], 'future.json'))).rejects.toThrow('版本不支持');
  });
  it('removes a key accidentally copied into user text from exports', async () => {
    const { controller } = setup();
    await controller.updateProvider({ ...controller.getState().settings.provider, apiKey: 'super-secret-key' });
    await controller.sendMessage('super-secret-key');
    expect(await (await controller.exportData()).text()).not.toContain('super-secret-key');
  });
  it('recovers safely from corrupted storage and retries no lost loading state', async () => {
    const storage = repository();
    const loadState = vi.fn(async () => { throw new Error('corrupt'); });
    const controller = createCompanionController({ storage: { ...storage, loadState } });
    await Promise.all([controller.initialize(), controller.initialize()]);
    expect(loadState).toHaveBeenCalledOnce();
    expect(controller.getState().conversations).toHaveLength(1);
  });
});

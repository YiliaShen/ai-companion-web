import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatChunk, ProviderChatInput, ProviderConfig } from '../../contracts';
import { personas } from '../personas';
import { createEmotionEngine } from '../emotion';
import { buildDemoReply, compileSystemPrompt, createChatProvider, parseSSE } from './index';

const config: ProviderConfig = { mode: 'openai-compatible', baseUrl: 'https://example.test/v1/', apiKey: 'secret-should-never-leak', model: 'test-model', temperature: .8, rememberKey: false };
const input = (persona = personas.shenxu): ProviderChatInput => ({ persona, userMessage: '今天工作很累', history: [], memories: [], reading: createEmotionEngine().analyze('今天工作很累', persona, []) });
const stream = (text: string, width = 1) => new ReadableStream<Uint8Array>({ start(controller) { const bytes = new TextEncoder().encode(text); for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width)); controller.close(); } });
const collect = async (chunks: AsyncIterable<ChatChunk>) => { const result: ChatChunk[] = []; for await (const chunk of chunks) result.push(chunk); return result; };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('demo persona voice and streaming', () => {
  it('is stable, genuinely distinct, and uses only its own memories', () => {
    const texts = Object.values(personas).map(persona => buildDemoReply(input(persona)));
    expect(new Set(texts).size).toBe(3);
    expect(buildDemoReply(input())).toBe(texts[0]);
    const request = input();
    request.memories = [{ id: 'foreign', personaId: 'jiangye', kind: 'preference', title: '饮品', content: '我喜欢抹茶', confidence: .9, source: 'user', createdAt: '', updatedAt: '', tags: [] }];
    expect(buildDemoReply(request)).not.toContain('抹茶');
    expect(compileSystemPrompt(request)).not.toContain('抹茶');
    request.memories[0].personaId = 'shenxu';
    request.userMessage = '今天工作很累，突然想喝抹茶';
    expect(buildDemoReply(request)).toContain('我喜欢抹茶');
    expect(compileSystemPrompt(request)).toContain('不冒充真人');
  });
  it('answers a request to listen like a person instead of quoting a template', () => {
    for (const persona of Object.values(personas)) {
      const request = input(persona);
      request.userMessage = '有些话想说，先听我说说好吗？';
      request.reading = createEmotionEngine().analyze(request.userMessage, persona, []);
      const reply = buildDemoReply(request);
      expect(reply).not.toMatch(/你说「|不必整理|这一小段日常|认真听完/);
      expect(reply.length).toBeLessThan(30);
    }
    expect(buildDemoReply({
      ...input(personas.shenxu),
      userMessage: '有些话想说，先听我说说好吗？',
      reading: createEmotionEngine().analyze('有些话想说，先听我说说好吗？', personas.shenxu, [])
    })).toBe('好。你说，我听着。');
  });
  it('streams multiple chunks and ends gracefully after cancellation', async () => {
    const abort = new AbortController();
    const chunks: ChatChunk[] = [];
    for await (const chunk of createChatProvider({ ...config, mode: 'demo' }).stream(input(), abort.signal)) {
      chunks.push(chunk);
      if (chunks.length === 2) abort.abort();
    }
    expect(chunks.map(chunk => chunk.type)).toEqual(['text-delta', 'text-delta', 'done']);
  });
});

describe('OpenAI-compatible SSE', () => {
  it('parses split UTF-8, CRLF, comments, multiline data and an unterminated final frame', async () => {
    const frames: string[] = [];
    for await (const frame of parseSSE(stream(': keepalive\r\nevent: message\r\ndata: {\r\ndata: "内容":"你好"}\r\n\r\ndata: [DONE]'), new AbortController().signal)) frames.push(frame);
    expect(frames).toEqual(['{\n"内容":"你好"}', '[DONE]']);
  });
  it('posts the required request and reads text deltas exactly once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream('data: {"choices":[{"index":0,"delta":{"content":"你好"}}]}\n\ndata: {"choices":[{"delta":{"content":"呀"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')));
    vi.stubGlobal('fetch', fetchMock);
    const request = input();
    request.history = [{ id: 'u', conversationId: 'c', role: 'user', kind: 'text', text: request.userMessage, status: 'sent', createdAt: '' }];
    const chunks = await collect(createChatProvider(config).stream(request, new AbortController().signal));
    expect(chunks).toEqual([{ type: 'text-delta', delta: '你好' }, { type: 'text-delta', delta: '呀' }, { type: 'done' }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Bearer ${config.apiKey}`);
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.messages.filter((message: { role: string }) => message.role === 'user')).toHaveLength(1);
  });
  it.each([401, 429, 500])('maps HTTP %s without exposing response text', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`echo key: ${config.apiKey}`, { status })));
    const chunks = await collect(createChatProvider(config).stream(input(), new AbortController().signal));
    expect(chunks[0].type).toBe('error');
    expect(chunks.at(-1)?.type).toBe('done');
    expect(JSON.stringify(chunks)).not.toContain(config.apiKey);
  });
  it('returns a readable error for malformed SSE and unfinished streams', async () => {
    for (const response of ['data: oops\n\n', 'data: {"choices":[{"delta":{"content":"一半"}}]}\n\n']) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream(response))));
      const chunks = await collect(createChatProvider(config).stream(input(), new AbortController().signal));
      expect(chunks.some(chunk => chunk.type === 'error')).toBe(true);
      expect(chunks.at(-1)?.type).toBe('done');
    }
  });
  it('aborts a stalled reader without an error or an extra delta', async () => {
    const abort = new AbortController();
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"先到"}}]}\n\n')); }, cancel }))));
    const chunks: ChatChunk[] = [];
    for await (const chunk of createChatProvider(config).stream(input(), abort.signal)) {
      chunks.push(chunk);
      if (chunk.type === 'text-delta') abort.abort();
    }
    expect(chunks).toEqual([{ type: 'text-delta', delta: '先到' }, { type: 'done' }]);
    expect(cancel).toHaveBeenCalled();
  });
  it('does not call a remote service for urgent safety or missing config', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const urgent = input(); urgent.reading.safety = { level: 'urgent', reason: 'test' };
    expect((await collect(createChatProvider(config).stream(urgent, new AbortController().signal)))[0].delta).toContain('紧急援助');
    expect((await collect(createChatProvider({ ...config, apiKey: '' }).stream(input(), new AbortController().signal)))[0].type).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import type { ChatChunk, ChatProvider, ProviderChatInput, ProviderConfig, ProviderMode } from '../../contracts';

class StubProvider implements ChatProvider {
  readonly id: ProviderMode;

  constructor(id: ProviderMode) {
    this.id = id;
  }

  async *stream(input: ProviderChatInput, signal: AbortSignal): AsyncIterable<ChatChunk> {
    const text = input.reading.safety.level === 'urgent'
      ? '先确保你现在是安全的。请立即联系当地急救或报警，并告诉一个你信任的人。'
      : `${input.persona.name}：我在听。你刚才说的“${input.userMessage.slice(0, 30)}”，我想再陪你多聊一会儿。`;

    for (const char of text) {
      if (signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 16));
      yield { type: 'text-delta', delta: char };
    }
    yield { type: 'done' };
  }
}

export function createChatProvider(config: ProviderConfig): ChatProvider {
  return new StubProvider(config.mode);
}

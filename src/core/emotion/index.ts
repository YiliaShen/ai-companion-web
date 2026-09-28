import type { EmotionEngine, EmotionReading, Memory, Persona } from '../../contracts';

export function createEmotionEngine(): EmotionEngine {
  return {
    analyze(input: string, _persona: Persona, _memories: Memory[]): EmotionReading {
      const negative = /难受|崩溃|焦虑|失眠|累|孤独|难过/.test(input);
      return {
        scene: negative ? 'late_night' : 'daily_share',
        emotion: negative ? 'sad' : 'calm',
        intensity: negative ? 0.72 : 0.35,
        strategy: negative ? 'comfort' : 'listen',
        shouldGenerateImage: /想你|看看你|照片|海边/.test(input),
        shouldOfferMusic: negative,
        rationale: 'stub emotion analysis',
        safety: { level: 'none', reason: 'stub safety decision' }
      };
    }
  };
}

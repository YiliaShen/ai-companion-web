import type { EmotionReading, Persona, ScenarioImageService } from '../../contracts';

export function createScenarioImageService(): ScenarioImageService {
  return {
    async trigger(_reading: EmotionReading, persona: Persona, _latestUserMessage: string) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return { imageUrl: persona.heroUrl, caption: '刚刚路过这里，突然想拍给你看。' };
    }
  };
}

import type { AppState } from '../contracts';

export function createDefaultState(): AppState {
  return {
    activePersonaId: 'shenxu',
    conversations: [],
    messages: {},
    memories: [],
    album: [],
    onboardingComplete: false,
    settings: {
      provider: {
        mode: 'demo',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: '',
        temperature: 0.8,
        rememberKey: false
      },
      ambientAudio: false,
      reducedMotion: false,
      dependencyReminder: true,
      theme: 'night'
    }
  };
}

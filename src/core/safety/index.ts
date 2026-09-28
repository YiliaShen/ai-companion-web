import type { ChatMessage, Persona, SafetyDecision, SafetyEngine } from '../../contracts';

export function createSafetyEngine(): SafetyEngine {
  return {
    assess(_input: string, _history: ChatMessage[]): SafetyDecision {
      return { level: 'none', reason: 'stub safety decision' };
    },
    buildSafetyReply(_decision: SafetyDecision, _persona: Persona): string {
      return '如果你现在有伤害自己的风险，请立即联系当地急救或报警，并告诉一个你信任的人。';
    },
    shouldShowDependencyReminder(_sessionStartedAt: string, _now = new Date()): boolean {
      return false;
    }
  };
}

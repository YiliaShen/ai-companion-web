import type { CandidateMemory, Memory, MemoryEngine, PersonaId } from '../../contracts';

export function createMemoryEngine(): MemoryEngine {
  return {
    extract(_input: string, _personaId: PersonaId): CandidateMemory[] {
      return [];
    },
    rankRelevant(memories: Memory[], _input: string, limit = 6): Memory[] {
      return memories.slice(0, limit);
    }
  };
}

import { describe, expect, it } from 'vitest';
import type { Memory } from '../../contracts';
import { createMemoryEngine } from './index';

const makeMemory = (id: string, personaId: Memory['personaId'], content: string): Memory => ({ id, personaId, kind: 'preference', title: '偏好', content, source: 'inferred', confidence: .9, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', tags: [] });
describe('durable, persona-scoped memories', () => {
  const engine = createMemoryEngine();
  it('extracts explicit preferences, boundaries, events, goals and relationships', () => {
    const result = engine.extract('我喜欢喝乌龙茶。我不喜欢被叫宝贝。我下周要面试。我计划明年考研。我妈妈住在杭州。', 'shenxu');
    expect(result.map(item => item.kind)).toEqual(['preference', 'boundary', 'event', 'goal', 'relationship']);
    expect(result.every(item => item.confidence >= .8)).toBe(true);
  });
  it.each(['我今天好累，特别焦虑。', '我很难过，我是个废物。', '我想自杀。', '如果我喜欢咖啡呢？', '她说“我喜欢咖啡”。', '我今天突然喜欢喝咖啡。', '我可能打算考研。'])('does not fossilize a transient or hypothetical statement: %s', text => {
    expect(engine.extract(text, 'shenxu')).toEqual([]);
  });
  it('deduplicates candidates and ranks relevant facts without changing source arrays', () => {
    expect(engine.extract('我喜欢乌龙茶。我喜欢乌龙茶。', 'shenxu')).toHaveLength(1);
    const memories = [makeMemory('coffee', 'shenxu', '我喜欢咖啡'), makeMemory('tea', 'shenxu', '我喜欢乌龙茶')];
    expect(engine.rankRelevant(memories, '乌龙茶', 1).map(item => item.id)).toEqual(['tea']);
    expect(memories[0].id).toBe('coffee');
    expect(engine.rankRelevant(memories, '一件完全无关的事')).toEqual([]);
  });
  it('fails closed for mixed personas unless explicitly scoped', () => {
    const memories = [makeMemory('a', 'shenxu', '我喜欢乌龙茶'), makeMemory('b', 'jiangye', '我喜欢乌龙茶')];
    expect(engine.rankRelevant(memories, '乌龙茶')).toEqual([]);
    expect(createMemoryEngine('shenxu').rankRelevant(memories, '乌龙茶').map(item => item.id)).toEqual(['a']);
    expect(createMemoryEngine('shenxu').extract('我喜欢乌龙茶', 'jiangye')).toEqual([]);
  });
});

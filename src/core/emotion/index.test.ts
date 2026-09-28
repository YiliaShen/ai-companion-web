import { describe, expect, it } from 'vitest';
import { createEmotionEngine } from './index';
import { personas } from '../personas';

const engine = createEmotionEngine();
const analyze = (text: string) => engine.analyze(text, personas.shenxu, []);
describe('deterministic emotion and scene analysis', () => {
  it.each([
    ['老板给了好多工作，我很焦虑', 'work_stress', 'anxious'],
    ['凌晨三点睡不着', 'late_night', 'anxious'],
    ['我好孤独，没人陪', 'loneliness', 'lonely'],
    ['我通过考试了，好开心！', 'celebration', 'happy'],
    ['和朋友吵架了，很生气', 'conflict', 'angry']
  ])('classifies %s', (text, scene, emotion) => {
    expect(analyze(text)).toMatchObject({ scene, emotion });
    expect(analyze(text)).toEqual(analyze(text));
    expect(analyze(text).intensity).toBeGreaterThanOrEqual(0);
    expect(analyze(text).intensity).toBeLessThanOrEqual(1);
  });
  it('only triggers appropriate requested images, with crisis taking priority', () => {
    expect(analyze('想看看你，发张海边照片吧').shouldGenerateImage).toBe(true);
    expect(analyze('海边，但不要给我发照片').shouldGenerateImage).toBe(false);
    expect(analyze('我想自杀，发张照片吧')).toMatchObject({ scene: 'crisis', strategy: 'safety_redirect', shouldGenerateImage: false, shouldOfferMusic: false, safety: { level: 'urgent' } });
  });
  it('respects listening requests and scales intensity', () => {
    expect(analyze('工作很焦虑，只想说说，不要建议').strategy).toBe('listen');
    expect(analyze('有点焦虑').intensity).toBeLessThan(analyze('特别焦虑！！！').intensity);
    expect(analyze('我已经不焦虑了').emotion).toBe('calm');
  });
});

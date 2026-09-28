import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmotionReading } from '../../contracts';
import { shenxu } from '../personas/shenxu';
import { createScenarioImageService, getScenarioImageFallback, getScenarioImages, ImageSafetyError } from './index';

const reading: EmotionReading = {
  scene: 'late_night', emotion: 'calm', intensity: 0.4, strategy: 'listen', shouldGenerateImage: true,
  shouldOfferMusic: false, safety: { level: 'none', reason: 'test' }, rationale: 'test'
};
afterEach(() => vi.useRealTimers());

describe('scenario image delivery', () => {
  it('maps all seven safe scenes to stable local assets and persona-specific captions', () => {
    for (const personaId of ['shenxu', 'jiangye', 'linche'] as const) {
      const images = getScenarioImages(personaId);
      expect(Object.keys(images)).toHaveLength(7);
      expect(new Set(Object.values(images).map((image) => image.imageUrl)).size).toBeGreaterThanOrEqual(4);
      expect(images).toEqual(getScenarioImages(personaId));
      for (const image of Object.values(images)) {
        expect(image.imageUrl).toMatch(/assets\/scenes\/[a-z_]+\.jpg$/);
        expect(image.imageUrl).not.toMatch(/^https?:/);
        expect(image.caption).toContain('非实时照片');
        const ownName = { shenxu: '沈叙', jiangye: '江野', linche: '林澈' }[personaId];
        expect(image.caption).toContain(ownName);
        for (const name of ['沈叙', '江野', '林澈'].filter((name) => name !== ownName)) expect(image.caption).not.toContain(name);
      }
      expect(getScenarioImageFallback(personaId).imageUrl).toContain(`${personaId}-hero.jpg`);
    }
  });

  it('yields asynchronously, allowing text delivery while the image waits', async () => {
    vi.useFakeTimers();
    const delivered = vi.fn();
    const pending = createScenarioImageService().trigger(reading, shenxu, '看看夜景').then(delivered);
    await Promise.resolve();
    expect(delivered).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(849);
    expect(delivered).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(delivered).toHaveBeenCalledWith(getScenarioImages('shenxu').late_night);
  });

  it('refuses urgent signals, even if an upstream reading incorrectly asks for an image', async () => {
    vi.useFakeTimers();
    const service = createScenarioImageService();
    await expect(service.trigger({ ...reading, safety: { level: 'urgent', reason: 'test' } }, shenxu, '照片')).rejects.toBeInstanceOf(ImageSafetyError);
    await expect(service.trigger(reading, shenxu, '我现在想自杀，发张照片')).rejects.toBeInstanceOf(ImageSafetyError);
    await expect(service.trigger({ ...reading, scene: 'crisis' }, shenxu, '照片')).rejects.toBeInstanceOf(ImageSafetyError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('requires an explicit image trigger and rejects unknown personas', async () => {
    await expect(createScenarioImageService().trigger({ ...reading, shouldGenerateImage: false }, shenxu, '你好')).rejects.toThrow('未触发');
    await expect(createScenarioImageService().trigger(reading, { ...shenxu, id: '__proto__' as typeof shenxu.id }, '照片')).rejects.toThrow('角色');
  });
});

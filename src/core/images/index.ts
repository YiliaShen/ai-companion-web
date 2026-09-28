import type { EmotionReading, Persona, PersonaId, Scene, ScenarioImageService } from '../../contracts';
import { createSafetyEngine } from '../safety';

type SafeScene = Exclude<Scene, 'crisis'>;
type AssetScene = 'late_night' | 'seaside' | 'cafe' | 'city_walk' | 'celebration';
export interface ScenarioImage { imageUrl: string; caption: string }
export interface ScenarioImageOptions { delayMs?: number }

export class ImageSafetyError extends Error {
  constructor() { super('当前需要优先关注现实安全，已暂停场景图片。'); this.name = 'ImageSafetyError'; }
}

const sceneAssets: Record<SafeScene, AssetScene> = {
  late_night: 'late_night', work_stress: 'cafe', relationship: 'seaside',
  daily_share: 'city_walk', celebration: 'celebration', conflict: 'cafe', loneliness: 'seaside'
};
const captions: Record<PersonaId, Record<SafeScene, string>> = {
  shenxu: {
    late_night: '沈叙的夜间场景 · 窗边留了一盏暖灯，今天的事可以慢慢说。',
    work_stress: '沈叙的休息场景 · 一杯温热的咖啡，留一小段不必处理工作的时间。',
    relationship: '沈叙的海边场景 · 海面很宽，先给心里的话留些空间。',
    daily_share: '沈叙的城市场景 · 街角的光，适合收进今天的小记录。',
    celebration: '沈叙的庆祝场景 · 认真记住这一个值得高兴的时刻。',
    conflict: '沈叙的安静场景 · 先坐一会儿，不急着作决定。',
    loneliness: '沈叙的海边场景 · 一段安静的海岸，留给此刻的心情。'
  },
  jiangye: {
    late_night: '江野的夜间场景 · 城市也该下班啦，给今天按个暂停。',
    work_stress: '江野的咖啡场景 · 先给脑袋放个小假，工作等喝完这杯再说。',
    relationship: '江野的海边场景 · 想象吹一会儿海风，把憋着的话说出来。',
    daily_share: '江野的散步场景 · 街角这点小热闹，算今天的意外收获。',
    celebration: '江野的庆祝场景 · 这次真的值得给自己好好鼓个掌。',
    conflict: '江野的休息场景 · 先缓口气，再想下一句怎么说。',
    loneliness: '江野的海边场景 · 给心情换个背景，海风这一站。'
  },
  linche: {
    late_night: '林澈的夜间场景 · 灯光很轻，可以暂时不寻找答案。',
    work_stress: '林澈的咖啡场景 · 安静的桌边，留一点时间听听自己的想法。',
    relationship: '林澈的海边场景 · 看着潮水来去，慢慢分辨自己在意的是什么。',
    daily_share: '林澈的散步场景 · 平常的一段路，也能留下值得记住的细节。',
    celebration: '林澈的庆祝场景 · 让这一点喜悦在心里多停一会儿。',
    conflict: '林澈的安静场景 · 留一点距离，等感受清楚了再开口。',
    loneliness: '林澈的海边场景 · 空旷的海面，容得下暂时说不清的心情。'
  }
};

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** Bundled scene artwork, never a claim that the persona is a real person taking photos. */
export function getScenarioImages(personaId: PersonaId): Record<SafeScene, ScenarioImage> {
  if (!Object.hasOwn(captions, personaId)) throw new Error('无法识别的角色。');
  return Object.fromEntries(Object.entries(sceneAssets).map(([scene, asset]) => [scene, {
    imageUrl: assetUrl(`assets/scenes/${asset}.jpg`),
    caption: `${captions[personaId][scene as SafeScene]}（AI 角色场景示意，非实时照片）`
  }])) as Record<SafeScene, ScenarioImage>;
}

/** A local, persona-specific fallback for consumers handling an image load error. */
export function getScenarioImageFallback(personaId: PersonaId): ScenarioImage & { background: string } {
  if (!Object.hasOwn(captions, personaId)) throw new Error('无法识别的角色。');
  return {
    imageUrl: assetUrl(`assets/personas/${personaId}-hero.jpg`),
    caption: 'AI 角色场景暂时无法显示。',
    background: 'linear-gradient(145deg, #243b3a, #111c20 70%, #49332b)'
  };
}

export function createScenarioImageService(options: ScenarioImageOptions = {}): ScenarioImageService {
  const configured = options.delayMs ?? 850;
  const delay = Number.isFinite(configured) ? Math.max(0, Math.min(configured, 10_000)) : 850;
  const safety = createSafetyEngine();
  return {
    async trigger(reading: EmotionReading, persona: Persona, latestUserMessage: string) {
      if (reading.safety.level === 'urgent' || reading.scene === 'crisis' ||
          reading.strategy === 'safety_redirect' || safety.assess(latestUserMessage, []).level === 'urgent') {
        throw new ImageSafetyError();
      }
      if (!reading.shouldGenerateImage) throw new Error('当前场景未触发图片。');
      const image = getScenarioImages(persona.id)[reading.scene];
      if (!image) throw new Error('当前场景没有可用图片。');
      // A timer yields to text streaming and never performs network image generation.
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      return { ...image };
    }
  };
}

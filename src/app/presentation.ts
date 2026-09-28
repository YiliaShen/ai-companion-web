import type { MemoryKind, PersonaId, Scene } from '../contracts';

export const personaIds: PersonaId[] = ['shenxu', 'jiangye', 'linche'];
export const personaPresentation: Record<PersonaId, { romanized: string; avatar: string; hero: string; scene: string; note: string }> = {
  shenxu: { romanized: 'SHEN XU', avatar: 'assets/personas/shenxu-avatar.jpg', hero: 'assets/personas/shenxu-hero.jpg', scene: 'assets/scenes/late_night.jpg', note: '混血感的精致轮廓，慵懒从容里只对你认真。' },
  jiangye: { romanized: 'JIANG YE', avatar: 'assets/personas/jiangye-avatar.jpg', hero: 'assets/personas/jiangye-hero.jpg', scene: 'assets/scenes/city_walk.jpg', note: '刚下课的青涩男大，认真得藏不住。' },
  linche: { romanized: 'LIN CHE', avatar: 'assets/personas/linche-avatar.jpg', hero: 'assets/personas/linche-hero.jpg', scene: 'assets/scenes/seaside.jpg', note: '高冷总裁的沉静目光，习惯把重要的事安排妥当。' },
};
export const memoryLabels: Record<MemoryKind, string> = { preference: '小偏好', event: '经历', relationship: '重要的人', boundary: '相处边界', goal: '心愿' };
export const sceneLabels: Record<Scene, string> = { late_night: '深夜', work_stress: '忙碌之后', relationship: '相处', daily_share: '日常', celebration: '小小庆祝', conflict: '放慢一点', loneliness: '独处时刻', crisis: '陪伴' };
export function localAsset(url: string): string {
  if (url.startsWith('/assets/')) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url.startsWith('assets/') ? `${import.meta.env.BASE_URL}${url}` : url;
}
export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '刚刚' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date);
}
export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

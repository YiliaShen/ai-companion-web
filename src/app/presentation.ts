import type { MemoryKind, PersonaId, Scene } from '../contracts';

export const personaIds: PersonaId[] = ['shenxu', 'jiangye', 'linche'];
export const personaPresentation: Record<PersonaId, { romanized: string; avatar: string; hero: string; scene: string; note: string }> = {
  shenxu: { romanized: 'SHEN XU', avatar: 'assets/personas/shenxu-avatar.jpg', hero: 'assets/personas/shenxu-hero.jpg', scene: 'assets/scenes/late_night.jpg', note: '会把你的欲言又止，也认真放在心上。' },
  jiangye: { romanized: 'JIANG YE', avatar: 'assets/personas/jiangye-avatar.jpg', hero: 'assets/personas/jiangye-hero.jpg', scene: 'assets/scenes/city_walk.jpg', note: '陪你把平凡的一天，过得有一点意思。' },
  linche: { romanized: 'LIN CHE', avatar: 'assets/personas/linche-avatar.jpg', hero: 'assets/personas/linche-hero.jpg', scene: 'assets/scenes/seaside.jpg', note: '留一点空白，让你慢慢听见自己。' },
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

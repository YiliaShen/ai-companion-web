import { GearSix, Moon, ChatCircle, Sparkle, Images } from '@phosphor-icons/react';
import type { Persona, PersonaId } from '../contracts';
import { personaIds, personaPresentation } from '../app/presentation';
import { Media } from './Media';

export type View = 'chat' | 'memory' | 'album' | 'settings';
const views: { id: View; label: string; icon: typeof ChatCircle }[] = [
  { id: 'chat', label: '对话', icon: ChatCircle }, { id: 'memory', label: '记忆', icon: Sparkle },
  { id: 'album', label: '相册', icon: Images }, { id: 'settings', label: '设置', icon: GearSix },
];
export function PersonaOrbit({ personas, activeId, onSelect, onSettings, disabled = false }: { personas: Record<PersonaId, Persona>; activeId: PersonaId; onSelect: (id: PersonaId) => void; onSettings: () => void; disabled?: boolean }) {
  return <aside className="persona-rail" aria-label="角色轨道">
    <a className="brand-mark" href="#" aria-label="Mira 首页" onClick={(event) => { event.preventDefault(); onSelect(activeId); }}><Moon size={29} weight="light" /></a>
    <div className="rail-line" />
    <div className="orbit-people" role="group" aria-label="选择陪伴角色">
      {personaIds.map((id) => <button key={id} type="button" className={`orbit-person ${id === activeId ? 'is-active' : ''}`} onClick={() => onSelect(id)} disabled={disabled} aria-label={`与${personas[id].name}对话`} aria-pressed={id === activeId} title={personas[id].name}>
        <Media src={personaPresentation[id].avatar} alt={personas[id].name} portrait eager /><span className="orbit-name">{personas[id].name}</span>
      </button>)}
    </div>
    <span className="rail-caption" aria-hidden="true">一直有回声</span>
    <button type="button" className="icon-button rail-settings" onClick={onSettings} aria-label="打开设置"><GearSix size={22} /></button>
  </aside>;
}
export function Navigation({ view, onChange, mobile = false }: { view: View; onChange: (view: View) => void; mobile?: boolean }) {
  return <nav className={mobile ? 'mobile-nav' : 'desktop-nav'} aria-label={mobile ? '底部导航' : '空间导航'}>
    {views.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onChange(id)} className={view === id ? 'is-active' : ''} aria-current={view === id ? 'page' : undefined}><Icon size={21} weight={view === id ? 'fill' : 'regular'} /><span>{label}</span></button>)}
  </nav>;
}

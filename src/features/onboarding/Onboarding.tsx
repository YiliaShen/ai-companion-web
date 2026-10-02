import { useState } from 'react';
import { ArrowRight, Check, Moon } from '@phosphor-icons/react';
import type { Persona, PersonaId } from '../../contracts';
import { personaIds, personaPresentation } from '../../app/presentation';
import { Media } from '../../components/Media';

export function Onboarding({ personas, onSelect }: { personas: Record<PersonaId, Persona>; onSelect: (id: PersonaId) => Promise<boolean> }) {
  const [selected, setSelected] = useState<PersonaId>('shenxu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const persona = personas[selected];
  async function start() {
    setBusy(true); setError(false);
    try { if (!await onSelect(selected)) setError(true); } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <main className="onboarding">
    <header className="onboarding-brand"><Moon size={27} weight="light" /><span>Mira</span><span className="brand-aside">给情绪一个落脚处</span></header>
    <section className="onboarding-intro">
      <h1>今晚，<br />想和谁说说话？</h1>
      <p>不必组织好语言。<br />选一个让你自在的声音，从今天开始。</p>
      <div className="persona-choices" role="group" aria-label="选择你的陪伴角色">
        {personaIds.map((id) => <button key={id} type="button" className={`persona-choice ${selected === id ? 'is-selected' : ''}`} aria-pressed={selected === id} onClick={() => setSelected(id)} disabled={busy}>
          <Media src={personaPresentation[id].avatar} alt={personas[id].name} portrait eager />
          <span><strong>{personas[id].name}</strong><small>{personas[id].tagline}</small></span>
          {selected === id && <Check size={19} />}
        </button>)}
      </div>
      <button type="button" className="primary-button onboarding-start" onClick={() => void start()} disabled={busy}>{busy ? '正在打开你们的空间…' : `和${persona.name}聊聊`}<ArrowRight size={19} /></button>
      {error && <p className="inline-error" role="alert">这次没能进入，请再试一次。</p>}
    </section>
    <section className="onboarding-portrait" aria-label={`${persona.name}的介绍`}>
      <Media key={selected} src={personaPresentation[selected].hero} alt={`${persona.name}，虚构 AI 角色的示意人像`} portrait eager />
      <div className="portrait-copy"><span className="portrait-romanized">{personaPresentation[selected].romanized}</span><h2>{persona.name}<small>{persona.ageLabel} 岁的人设</small></h2><p>{personaPresentation[selected].note}</p><blockquote>“{persona.greeting}”</blockquote></div>
    </section>
  </main>;
}

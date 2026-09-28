import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CaretDown, Headphones, Moon, X } from '@phosphor-icons/react';
import { useReducedMotion } from 'motion/react';
import type { AlbumPhoto, ChatMessage, Memory, PersonaId } from './contracts';
import { personas } from './core/personas';
import { createSafetyEngine } from './core/safety';
import { useCompanion } from './state/CompanionProvider';
import { personaPresentation } from './app/presentation';
import { PersonaOrbit, Navigation, type View } from './components/PersonaOrbit';
import { Media } from './components/Media';
import { SafetyBanner } from './components/SafetyBanner';
import { Onboarding } from './features/onboarding/Onboarding';
import { Composer } from './features/chat/Composer';
import { MessageStream } from './features/chat/MessageStream';
import { MemoryConstellation, MemoryDetail, MemoryView } from './features/memory/MemoryConstellation';
import { AlbumGrid, AlbumView, PhotoLightbox } from './features/album/Album';
import { AmbientPlayer } from './features/ambient/AmbientPlayer';
import { SettingsView } from './features/settings/SettingsView';

export function App() {
  const { controller, state, loading, sending, error, perform, refresh, initialize, dismissError } = useCompanion();
  const [view, setView] = useState<View>('chat');
  const [sessionEntered, setSessionEntered] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [messagePhoto, setMessagePhoto] = useState<AlbumPhoto | null>(null);
  const [sessionStarted] = useState(() => new Date().toISOString());
  const [reminderDue, setReminderDue] = useState(false);
  const [dismissedSafetyKey, setDismissedSafetyKey] = useState('');
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = state.settings.reducedMotion || Boolean(systemReducedMotion);
  const persona = personas[state.activePersonaId];
  const conversation = [...state.conversations].filter((item) => item.personaId === persona.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const messages = useMemo(() => conversation ? state.messages[conversation.id] ?? [] : [], [conversation, state.messages]);
  const memories = state.memories.filter((memory) => memory.personaId === persona.id);
  const photos = state.album.filter((photo) => photo.personaId === persona.id);
  const selectedMemory = memories.find((memory) => memory.id === memoryId);
  const safetyEngine = useMemo(() => createSafetyEngine(), []);
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  const decision = useMemo(() => safetyEngine.assess(latestUser?.text ?? '', messages), [safetyEngine, latestUser?.text, messages]);
  const safetyKey = `${persona.id}:${latestUser?.id ?? ''}:${decision.level}`;
  const isStreaming = sending || messages.some((message) => message.status === 'streaming');

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [state.settings.theme, reducedMotion]);
  useEffect(() => {
    const check = () => setReminderDue(state.settings.dependencyReminder && safetyEngine.shouldShowDependencyReminder(sessionStarted));
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [safetyEngine, sessionStarted, state.settings.dependencyReminder]);

  async function selectPersona(id: PersonaId) {
    if (isStreaming) return false;
    const success = await perform(() => controller.selectPersona(id));
    if (success) { setSessionEntered(true); setView('chat'); setShowPeople(false); setShowContext(false); setMemoryId(null); setPhotoId(null); }
    return success;
  }
  function navigate(next: View) { setView(next); setShowContext(false); setShowPeople(false); }
  const send = (text: string) => perform(() => controller.sendMessage(text), 'send');
  function stop() { controller.stopStreaming(); refresh(); }
  function openPhoto(message: ChatMessage) {
    const existing = photos.find((photo) => photo.messageId === message.id);
    if (existing) setPhotoId(existing.id);
    else if (message.imageUrl) setMessagePhoto({ id: message.id, personaId: persona.id, messageId: message.id, imageUrl: message.imageUrl, caption: message.imageCaption || message.text || '分享给你的此刻', scene: 'daily_share', createdAt: message.createdAt, favorite: false });
  }
  function favorite(id: string) { void perform(() => controller.favoritePhoto(id)); }
  function chooseMemory(memory: Memory) { setMemoryId(memory.id); }

  if (loading) return <main className="loading-shell" aria-busy="true" aria-label="正在打开 Mira"><div className="loading-rail"><Moon size={28} /><i /><i /><i /></div><div className="loading-conversation"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-message" /><div className="skeleton skeleton-message short" /><p role="status">正在整理你们的共同记忆…</p><div className="skeleton skeleton-composer" /></div><div className="loading-context"><div className="skeleton skeleton-portrait" /><div className="skeleton skeleton-message" /></div></main>;
  if (!state.onboardingComplete && !sessionEntered) return <>{error && <div className="startup-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => void initialize()}>重新打开</button></div>}<Onboarding personas={personas} onSelect={selectPersona} /></>;

  return <div className={`app-shell ${showContext ? 'show-mobile-context' : ''}`}>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <PersonaOrbit personas={personas} activeId={persona.id} onSelect={(id) => void selectPersona(id)} onSettings={() => navigate('settings')} disabled={isStreaming} />
    <main className="main-panel" id="main-content">
      <header className="conversation-header"><button type="button" className="current-persona" onClick={() => setShowPeople(!showPeople)} aria-expanded={showPeople} aria-controls="mobile-personas" disabled={isStreaming}>
        <Media src={personaPresentation[persona.id].avatar} alt={persona.name} portrait eager /><span><strong>{persona.name}</strong><small><i />{isStreaming ? '正在认真回应' : 'AI 陪伴 · 随时可以开口'}</small></span><CaretDown size={16} className="persona-caret" />
      </button><Navigation view={view} onChange={navigate} /><button type="button" className="icon-button mobile-context-toggle" onClick={() => setShowContext(true)} aria-label="打开氛围和角色空间"><Headphones size={22} /></button></header>
      {showPeople && <div id="mobile-personas" className="persona-switcher" role="group" aria-label="切换陪伴角色">{Object.values(personas).map((item) => <button type="button" key={item.id} disabled={isStreaming} aria-pressed={item.id === persona.id} onClick={() => void selectPersona(item.id)}><Media src={personaPresentation[item.id].avatar} alt={item.name} portrait /><span><strong>{item.name}</strong><small>{item.tagline}</small></span>{item.id === persona.id && <span className="current-indicator">当前</span>}</button>)}</div>}
      <SafetyBanner decision={dismissedSafetyKey === safetyKey && decision.level !== 'urgent' ? { ...decision, level: 'none' } : decision} dependencyReminder={reminderDue && state.settings.dependencyReminder && dismissedSafetyKey !== safetyKey} onDismiss={() => setDismissedSafetyKey(safetyKey)} />
      {error && view !== 'settings' && <div className="app-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={() => navigate('settings')}>检查设置</button><button className="icon-button" type="button" aria-label="收起错误提示" onClick={dismissError}><X size={17} /></button></div>}
      {view === 'chat' && <><MessageStream key={persona.id} persona={persona} messages={messages} sending={isStreaming} reducedMotion={reducedMotion} onRetry={(text) => void send(text)} onPhoto={openPhoto} /><Composer key={persona.id} name={persona.name} sending={isStreaming} onSend={send} onStop={stop} /></>}
      {view === 'memory' && <MemoryView key={persona.id} memories={memories} name={persona.name} onSelect={chooseMemory} />}
      {view === 'album' && <AlbumView key={persona.id} photos={photos} name={persona.name} onOpen={(photo) => setPhotoId(photo.id)} onFavorite={favorite} onChat={() => navigate('chat')} />}
      {view === 'settings' && <SettingsView onReset={() => { setSessionEntered(false); setView('chat'); }} />}
    </main>
    <aside className="context-panel" aria-label={`${persona.name}的空间`}><header className="context-mobile-header"><span>{persona.name}的空间</span><button className="icon-button" type="button" onClick={() => setShowContext(false)} aria-label="返回对话"><X size={22} /></button></header>
      <section className="companion-portrait"><Media src={personaPresentation[persona.id].hero} alt={`${persona.name}，虚构 AI 角色的示意人像`} portrait eager /><div className="companion-portrait-copy"><span>{personaPresentation[persona.id].romanized}</span><h2>{persona.name}</h2><p>{persona.tagline}</p></div></section>
      <div className="context-content"><section className="memory-preview"><div className="section-heading"><h3>共同记忆</h3><button type="button" className="text-button" onClick={() => navigate('memory')} aria-label="查看全部记忆">{memories.length}<ArrowRight size={16} /></button></div><MemoryConstellation memories={memories.slice(0, 5)} onSelect={chooseMemory} compact /><p className="context-note">{memories.length ? '那些你说过的小事，都在这里。' : `你告诉${persona.name}的偏好，会慢慢留在这里。`}</p></section>
        <section className="album-preview"><div className="section-heading"><h3>一起收藏的此刻</h3><button type="button" className="text-button" onClick={() => navigate('album')} aria-label="打开相册"><ArrowRight size={17} /></button></div>{photos.length ? <AlbumGrid photos={photos.slice(-2)} onOpen={(photo) => setPhotoId(photo.id)} onFavorite={favorite} compact /> : <button type="button" className="album-preview-empty" onClick={() => navigate('album')}><span>还没有照片</span><small>让风景在对话里自然发生</small><ArrowRight size={17} /></button>}</section>
        <AmbientPlayer enabled={state.settings.ambientAudio} onChange={(ambientAudio) => perform(() => controller.updateSettings({ ambientAudio }))} />
        <p className="context-footer">陪伴有回声，相处有边界。<br />人物与场景为示意素材 · Pexels / Unsplash</p>
      </div>
    </aside>
    <Navigation view={view} onChange={navigate} mobile />
    {selectedMemory && <MemoryDetail key={selectedMemory.id} memory={selectedMemory} evidence={Object.values(state.messages).flat().filter((message) => message.memoryIds?.includes(selectedMemory.id))} onClose={() => setMemoryId(null)} onSave={(patch) => perform(() => controller.updateMemory(selectedMemory.id, patch))} onDelete={() => perform(() => controller.deleteMemory(selectedMemory.id))} />}
    {photoId && <PhotoLightbox photos={photos} initialId={photoId} onClose={() => setPhotoId(null)} onFavorite={favorite} />}
    {messagePhoto && <PhotoLightbox photos={[messagePhoto]} initialId={messagePhoto.id} onClose={() => setMessagePhoto(null)} />}
  </div>;
}

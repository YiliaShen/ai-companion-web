import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Coffee, Heart, Moon, Smiley, Stop } from '@phosphor-icons/react';

const shortcuts = [
  { label: '有点累', text: '今天有点累，想和你待一会儿。', icon: Coffee },
  { label: '睡不着', text: '还没睡着，想找你说说话。', icon: Moon },
  { label: '想被听见', text: '有些话想说，先听我说说好吗？', icon: Heart },
  { label: '分享开心', text: '今天有一件开心的小事，想告诉你。', icon: Smiley },
];
export function Composer({ name, sending, onSend, onStop }: { name: string; sending: boolean; onSend: (text: string) => Promise<boolean>; onStop: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const busy = sending || submitting;
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const draft = text.trim();
    if (!draft || busy || inFlight.current) return;
    inFlight.current = true; setSubmitting(true);
    try { if (await onSend(draft)) setText((current) => current.trim() === draft ? '' : current); }
    finally { inFlight.current = false; setSubmitting(false); textarea.current?.focus(); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault(); void send();
    }
  }
  return <form className="composer" onSubmit={(event) => void send(event)}>
    <div className="emotion-shortcuts" aria-label="情绪快捷语">
      {shortcuts.map(({ label, text: phrase, icon: Icon }) => <button key={label} type="button" onClick={() => { setText(phrase); textarea.current?.focus(); }} disabled={busy}><Icon size={16} /><span>{label}</span></button>)}
    </div>
    <div className="composer-field">
      <label className="sr-only" htmlFor="message-draft">给{name}的消息</label>
      <textarea ref={textarea} id="message-draft" rows={2} value={text} maxLength={8000} placeholder={`和${name}说说，此刻的心情…`} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} />
      <div className="composer-bottom"><span>{text.length > 7000 ? `${text.length} / 8000` : '不必想好开场白'}</span>
        {busy ? <button className="send-button stop-button" type="button" aria-label="停止回复" onClick={onStop}><Stop size={17} weight="fill" /><span>停一下</span></button>
          : <button className="send-button" type="submit" disabled={!text.trim()} aria-label="发送消息"><ArrowUp size={23} weight="bold" /></button>}
      </div>
    </div>
    <p className="composer-note">Mira 是 AI 陪伴，重要的事也记得和现实中信任的人聊聊。</p>
  </form>;
}

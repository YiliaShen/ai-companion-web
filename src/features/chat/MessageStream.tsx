import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowClockwise, Headphones, ImageSquare } from '@phosphor-icons/react';
import type { ChatMessage, Persona } from '../../contracts';
import { formatDate, formatTime, personaPresentation } from '../../app/presentation';
import { Media } from '../../components/Media';

export function MessageStream({ messages, persona, sending, reducedMotion, onRetry, onPhoto }: { messages: ChatMessage[]; persona: Persona; sending: boolean; reducedMotion: boolean; onRetry: (text: string) => void; onPhoto: (message: ChatMessage) => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const last = messages.at(-1);
  useEffect(() => {
    if (stickToBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length, last?.text, last?.imageUrl, sending]);
  function jumpToBottom() {
    stickToBottom.current = true; setShowLatest(false);
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' });
  }
  return <div className="message-region">
    <div className="message-stream" ref={scroll} onScroll={() => {
      const element = scroll.current;
      if (element) { stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; setShowLatest(!stickToBottom.current); }
    }}>
      {messages.length === 0 ? <div className="conversation-opening">
        <Media className="opening-scene" src={personaPresentation[persona.id].scene} alt="陪伴空间的生活场景示意图" eager />
        <span className="opening-line" />
        <h2>把今天，慢慢说给我听。</h2><p>{persona.greeting}</p>
        <span className="opening-caption">一段只属于你们的对话，从这里开始。</span>
      </div> : <div role="log" aria-label={`与${persona.name}的对话`} aria-live="polite" aria-relevant="additions" aria-busy={sending}>
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDate = !previous || formatDate(previous.createdAt) !== formatDate(message.createdAt);
          const system = message.role === 'system' || message.kind === 'system';
          return <div key={message.id}>
            {showDate && <div className="message-date"><span>{formatDate(message.createdAt)}</span></div>}
            {system ? <p className="system-message">{message.text}</p> : <article className={`message message-${message.role}`} aria-label={`${message.role === 'user' ? '你' : persona.name}的消息`}>
              {message.role === 'assistant' && <Media className="message-avatar" src={personaPresentation[persona.id].avatar} alt={persona.name} portrait />}
              <div className="message-content">
                <div className="message-meta"><span>{message.role === 'user' ? '你' : persona.name}</span><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>
                {message.kind === 'selfie' && message.imageUrl && <button className="message-photo" type="button" onClick={() => onPhoto(message)} aria-label={`查看照片：${message.imageCaption || '此刻的风景'}`}><Media src={message.imageUrl} alt={message.imageCaption || `${persona.name}分享的场景示意照片`} /><span><ImageSquare size={15} />{message.imageCaption || '分享给你的此刻'}</span></button>}
                {message.kind === 'voice_note' && <span className="voice-label"><Headphones size={17} />语音内容</span>}
                {(message.text || message.status === 'streaming') && <div className="message-bubble"><p>{message.text || '正在想怎么回应你…'}{message.status === 'streaming' && <span className="stream-caret" aria-hidden="true" />}</p></div>}
                {message.status === 'failed' && <div className="message-failed"><span>这条消息没能完成</span><button className="text-button" type="button" disabled={sending} onClick={() => {
                  const source = message.role === 'user' ? message : messages.slice(0, index).reverse().find((item) => item.role === 'user');
                  if (source) onRetry(source.text);
                }}><ArrowClockwise size={14} />再试一次</button></div>}
              </div>
            </article>}
          </div>;
        })}
      </div>}
      {sending && <div className="typing-indicator" role="status"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>{persona.name}正在回应，随时可以停下</span></div>}
    </div>
    {showLatest && <button className="latest-button" type="button" onClick={jumpToBottom}><ArrowDown size={16} />回到最新消息</button>}
  </div>;
}

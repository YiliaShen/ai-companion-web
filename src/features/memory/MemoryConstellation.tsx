import { useState, type CSSProperties } from 'react';
import { ArrowRight, PencilSimple, Sparkle, Trash, X } from '@phosphor-icons/react';
import type { ChatMessage, Memory, MemoryKind } from '../../contracts';
import { formatDate, memoryLabels } from '../../app/presentation';
import { Dialog } from '../../components/Dialog';

const positions = [[23, 27], [62, 20], [78, 54], [46, 51], [22, 73], [63, 80], [87, 25], [38, 89], [12, 49]];
const kinds = Object.keys(memoryLabels) as MemoryKind[];

export function MemoryConstellation({ memories, onSelect, compact = false }: { memories: Memory[]; onSelect: (memory: Memory) => void; compact?: boolean }) {
  const visible = memories.slice(0, 9);
  return <div className={`constellation ${compact ? 'constellation-compact' : ''}`} role="group" aria-label="记忆星图">
    <div className="constellation-orbit orbit-one" aria-hidden="true" /><div className="constellation-orbit orbit-two" aria-hidden="true" />
    {visible.length === 0 ? <div className="constellation-empty"><Sparkle size={27} weight="light" /><p>记忆，会慢慢亮起来</p></div> : visible.map((memory, index) => {
      const [x, y] = positions[index];
      return <button type="button" key={memory.id} className="memory-node" style={{ '--node-x': `${x}%`, '--node-y': `${y}%`, '--node-delay': `${index * 35}ms` } as CSSProperties} onClick={() => onSelect(memory)} aria-label={`查看记忆：${memory.title}`}><span className="node-dot" /><span>{memory.title}</span></button>;
    })}
    {visible.length > 1 && <div className="constellation-connections" aria-hidden="true">{visible.slice(1).map((memory, index) => {
      const [x1, y1] = positions[index]; const [x2, y2] = positions[index + 1];
      return <i key={memory.id} style={{ left: `${x1}%`, top: `${y1}%`, width: `${Math.hypot(x2 - x1, (y2 - y1) / 1.7)}%`, transform: `rotate(${Math.atan2((y2 - y1) / 1.7, x2 - x1) * 180 / Math.PI}deg)` }} />;
    })}</div>}
  </div>;
}

export function MemoryCard({ memory, onSelect }: { memory: Memory; onSelect: (memory: Memory) => void }) {
  return <button type="button" className="memory-card" onClick={() => onSelect(memory)}><span className="memory-kind">{memoryLabels[memory.kind]}</span><strong>{memory.title}</strong><p>{memory.content}</p><span className="memory-card-bottom">{formatDate(memory.updatedAt)}<ArrowRight size={17} /></span></button>;
}

export function MemoryView({ memories, name, onSelect }: { memories: Memory[]; name: string; onSelect: (memory: Memory) => void }) {
  const [filter, setFilter] = useState<MemoryKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const filtered = memories.filter((memory) => (filter === 'all' || memory.kind === filter) && `${memory.title} ${memory.content} ${memory.tags.join(' ')}`.includes(search.trim()));
  return <section className="feature-view memory-view">
    <header className="feature-heading"><div><h1>你们的记忆星图</h1><p>被认真听见的小事，也值得被记住。</p></div><span className="quiet-count">{memories.length} 段记忆</span></header>
    <MemoryConstellation memories={filtered} onSelect={onSelect} />
    <div className="memory-tools"><div className="filter-tabs" role="group" aria-label="筛选记忆类型">{(['all', ...kinds] as const).map((kind) => <button key={kind} type="button" className={filter === kind ? 'is-active' : ''} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? '全部' : memoryLabels[kind]}</button>)}</div><label className="search-field"><span className="sr-only">搜索记忆</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="找一段记忆" type="search" /></label></div>
    {filtered.length > 0 ? <div className="memory-grid">{filtered.map((memory) => <MemoryCard key={memory.id} memory={memory} onSelect={onSelect} />)}</div> : <div className="empty-state"><Sparkle size={30} weight="light" /><h2>{memories.length ? '还没有找到这段记忆' : '先聊聊你喜欢的事'}</h2><p>{memories.length ? '换个词，或试试查看全部记忆。' : `你告诉${name}的偏好会出现在这里。每一条记忆，你都可以查看、修改或删除。`}</p></div>}
  </section>;
}

export function MemoryDetail({ memory, evidence, onClose, onSave, onDelete }: { memory: Memory; evidence: ChatMessage[]; onClose: () => void; onSave: (patch: Partial<Memory>) => Promise<boolean>; onDelete: () => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [kind, setKind] = useState(memory.kind);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(false);
  async function save() {
    setBusy(true); setError(false);
    try { if (await onSave({ title: title.trim(), content: content.trim(), kind })) { setEditing(false); onClose(); } else setError(true); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true); setError(false);
    try { if (await onDelete()) onClose(); else setError(true); }
    finally { setBusy(false); }
  }
  return <Dialog title={editing ? '整理这段记忆' : '一段被记住的小事'} onClose={onClose} className="memory-dialog">
    {editing ? <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="memory-edit-form">
      <label className="field-label">记忆标题<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
      <label className="field-label">类型<select value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)}>{kinds.map((item) => <option key={item} value={item}>{memoryLabels[item]}</option>)}</select></label>
      <label className="field-label">记忆内容<textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} required /></label>
      <div className="button-row"><button type="button" className="secondary-button" onClick={() => setEditing(false)} disabled={busy}>取消</button><button type="submit" className="primary-button" disabled={busy || !title.trim() || !content.trim()}>{busy ? '正在保存…' : '保存记忆'}</button></div>
    </form> : <>
      <span className="memory-kind">{memoryLabels[memory.kind]}</span><h3 className="memory-detail-title">{memory.title}</h3><p className="memory-detail-content">{memory.content}</p>
      <dl className="memory-facts"><div><dt>记录于</dt><dd>{formatDate(memory.createdAt)}</dd></div><div><dt>来源</dt><dd>{memory.source === 'user' ? '你亲口分享的' : memory.source === 'inferred' ? '从对话中整理，可能需要确认' : '从备份导入'}</dd></div></dl>
      <section className="memory-evidence"><h4>为什么记住这件事</h4>{evidence.length ? evidence.map((message) => <blockquote key={message.id}>{message.text}</blockquote>) : <p>这条记忆来自你们的交流，当前记录中没有关联的原句。如果理解得不对，可以随时修改。</p>}</section>
      <div className="button-row"><button className="text-button danger-text" type="button" disabled={busy} onClick={() => void remove()}><Trash size={17} />{confirmDelete ? '确认删除这条记忆' : '删除'}</button>{confirmDelete && <button className="icon-button" aria-label="取消删除" type="button" onClick={() => setConfirmDelete(false)}><X size={17} /></button>}<button className="secondary-button" type="button" onClick={() => setEditing(true)}><PencilSimple size={17} />修改记忆</button></div>
      {confirmDelete && <p className="field-help">删除后，这条记忆不再用于后续回复；原对话会保留。</p>}
    </>}
    {error && <p role="alert" className="inline-error">暂时没能保存这次修改，请重试。</p>}
  </Dialog>;
}

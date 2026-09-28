import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeSlash, Info, ShieldCheck, Trash } from '@phosphor-icons/react';
import type { AppSettings, ProviderConfig } from '../../contracts';
import { useCompanion } from '../../state/CompanionProvider';
import { Dialog } from '../../components/Dialog';

function Toggle({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="setting-toggle"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><span className="switch-track" aria-hidden="true" /></label>;
}
export function SettingsView({ onReset }: { onReset: () => void }) {
  const { controller, state, perform, error, sending } = useCompanion();
  const [config, setConfig] = useState(state.settings.provider);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [validation, setValidation] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  function updateConfig(patch: Partial<ProviderConfig>) { setConfig((current) => ({ ...current, ...patch })); setNotice(''); setValidation(''); }
  async function save(event?: FormEvent, override?: ProviderConfig) {
    event?.preventDefault();
    const next = override ?? config;
    if (next.mode === 'openai-compatible') {
      try {
        const url = new URL(next.baseUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { setValidation('请填写完整的服务地址，例如 https://api.example.com/v1。'); return; }
      if (!next.model.trim()) { setValidation('请填写服务商提供的模型名称。'); return; }
    }
    setBusy(true); setNotice(''); setValidation('');
    if (await perform(() => controller.updateProvider({ ...next, baseUrl: next.baseUrl.trim(), model: next.model.trim() }))) {
      setConfig(controller.getState().settings.provider); setNotice(next.mode === 'demo' ? '已切换到体验模式。可以回去继续聊了。' : '设置已保存。下一条消息将发送到你配置的服务。');
    }
    setBusy(false);
  }
  async function updateSettings(patch: Partial<AppSettings>) {
    setBusy(true); setNotice('');
    if (await perform(() => controller.updateSettings(patch))) setNotice('已保存你的偏好。');
    setBusy(false);
  }
  async function exportData() {
    setBusy(true);
    await perform(async () => {
      const blob = await controller.exportData(); const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `mira-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('备份已准备好，请妥善保存其中的私人记录。');
    });
    setBusy(false);
  }
  return <section className="feature-view settings-view"><header className="feature-heading"><div><h1>让这里，更像你的空间</h1><p>连接方式、相处边界和记录，都由你决定。</p></div></header>
    <form className="settings-section" onSubmit={(event) => void save(event)}>
      <h2>对话连接</h2><div className="provider-options" role="group" aria-label="选择对话服务"><button type="button" className={config.mode === 'demo' ? 'is-active' : ''} aria-pressed={config.mode === 'demo'} onClick={() => updateConfig({ mode: 'demo' })}><strong>体验模式</strong><span>不用密钥，先熟悉彼此</span>{config.mode === 'demo' && <Check size={18} />}</button><button type="button" className={config.mode === 'openai-compatible' ? 'is-active' : ''} aria-pressed={config.mode === 'openai-compatible'} onClick={() => updateConfig({ mode: 'openai-compatible' })}><strong>连接自己的模型</strong><span>OpenAI 兼容服务</span>{config.mode === 'openai-compatible' && <Check size={18} />}</button></div>
      {config.mode === 'demo' ? <p className="provider-info"><ShieldCheck size={19} />体验模式使用本地预设回复，不会把对话发送到模型服务。</p> : <div className="provider-fields">
        <p className="provider-info"><Info size={19} />连接后，对话与相关记忆会发送到你填写的服务地址。请只使用信任的服务。</p>
        <label className="field-label">服务地址<input type="url" value={config.baseUrl} onChange={(event) => updateConfig({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" autoComplete="url" required /></label>
        <label className="field-label">模型名称<input value={config.model} onChange={(event) => updateConfig({ model: event.target.value })} placeholder="填写服务商提供的模型 ID" spellCheck={false} required /></label>
        <label className="field-label">API 密钥<span className="secret-field"><input type={revealed ? 'text' : 'password'} value={config.apiKey} onChange={(event) => updateConfig({ apiKey: event.target.value })} placeholder="在此粘贴密钥" autoComplete="off" spellCheck={false} /><button className="icon-button" type="button" onClick={() => setRevealed(!revealed)} aria-label={revealed ? '隐藏密钥' : '显示密钥'}>{revealed ? <EyeSlash size={20} /> : <Eye size={20} />}</button></span></label>
        <Toggle title="在这台设备记住密钥" description="默认只在本次会话使用。共享设备建议保持关闭。" checked={config.rememberKey} onChange={(rememberKey) => updateConfig({ rememberKey })} />
        <label className="field-label temperature-label">回应的自由度 <output>{config.temperature.toFixed(1)}</output><input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(event) => updateConfig({ temperature: Number(event.target.value) })} /><span className="range-labels"><span>更稳定</span><span>更有变化</span></span></label>
      </div>}
      {(validation || error) && <div className="settings-error" role="alert"><p>{validation || error}</p><button type="button" className="text-button" disabled={busy || sending} onClick={() => void save(undefined, { ...config, mode: 'demo' })}>切回体验模式</button></div>}
      <button className="primary-button" type="submit" disabled={busy || sending}>{busy ? '正在保存…' : '保存连接设置'}</button>{sending && <p className="field-help">等这条回复结束，或先停止回复，再调整连接。</p>}
    </form>
    <section className="settings-section"><h2>按你的节奏</h2><Toggle title="减少动态效果" description="让界面更安静；系统的减少动态效果设置也会被尊重。" checked={state.settings.reducedMotion} disabled={busy} onChange={(reducedMotion) => void updateSettings({ reducedMotion })} /><Toggle title="适时提醒休息" description="聊得久了，提醒你照顾现实中的自己。" checked={state.settings.dependencyReminder} disabled={busy} onChange={(dependencyReminder) => void updateSettings({ dependencyReminder })} /><label className="setting-theme"><span><strong>空间色调</strong><small>选择此刻舒服的光线</small></span><select aria-label="空间色调" value={state.settings.theme} disabled={busy} onChange={(event) => void updateSettings({ theme: event.target.value as AppSettings['theme'] })}><option value="night">夜色</option><option value="dawn">晨光</option></select></label></section>
    <section className="settings-section"><h2>你的记录，由你保管</h2><p className="field-help">对话、记忆和相册保存在这台设备。清除浏览器数据可能让它们丢失，建议定期导出备份。</p><div className="data-actions"><button type="button" className="secondary-button" onClick={() => void exportData()} disabled={busy}><ArrowDown size={18} />导出备份</button><button type="button" className="secondary-button" onClick={() => fileInput.current?.click()} disabled={busy || sending}><ArrowUp size={18} />导入备份</button><input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="选择 Mira 备份文件" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); event.target.value = ''; }} /><button type="button" className="text-button danger-text" onClick={() => setResetOpen(true)} disabled={busy || sending}><Trash size={17} />清空本地记录</button></div></section>
    <div className="settings-status" role="status">{notice && <><Check size={18} />{notice}</>}</div>
    <p className="settings-footer">Mira · AI 陪伴空间<br />可以被倾听，也可以随时离开。</p>
    {resetOpen && <Dialog title="清空这台设备上的记录？" onClose={() => setResetOpen(false)}><p>三位角色的对话、记忆、照片和设置都会被清除，无法撤销。想留下它们的话，请先导出备份。</p><div className="button-row"><button className="secondary-button" type="button" onClick={() => setResetOpen(false)}>再想想</button><button className="danger-button" disabled={busy} type="button" onClick={async () => { setBusy(true); if (await perform(() => controller.resetAllData())) { setResetOpen(false); onReset(); } setBusy(false); }}>确认清空</button></div></Dialog>}
    {importFile && <Dialog title="用备份恢复你的空间？" onClose={() => setImportFile(null)}><p>即将导入「{importFile.name}」。当前记录可能被备份内容替换，建议先导出一份现有记录。</p><div className="button-row"><button className="secondary-button" type="button" onClick={() => setImportFile(null)}>取消</button><button className="primary-button" type="button" disabled={busy} onClick={async () => { setBusy(true); if (await perform(() => controller.importData(importFile))) { setImportFile(null); setNotice('备份已恢复。'); setConfig(controller.getState().settings.provider); } setBusy(false); }}>确认导入</button></div>{error && <p className="inline-error" role="alert">没能读取这份备份，请检查文件是否完整。</p>}</Dialog>}
  </section>;
}

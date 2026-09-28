import { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play, SpeakerHigh, Waves } from '@phosphor-icons/react';

export function AmbientPlayer({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => Promise<boolean> }) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(28);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  useEffect(() => () => { void audio.current?.close(); }, []);
  useEffect(() => {
    if (!enabled && audio.current?.state === 'running') { void audio.current.suspend(); }
  }, [enabled]);
  async function toggle() {
    if (starting) return;
    setStarting(true); setError(false);
    try {
      if (playing && enabled) {
        await audio.current?.suspend(); setPlaying(false); await onChange(false); return;
      }
      if (!audio.current) {
        const context = new AudioContext();
        const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
        const channel = buffer.getChannelData(0);
        let last = 0;
        for (let index = 0; index < channel.length; index += 1) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; channel[index] = last * 3.5; }
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
        const volumeNode = context.createGain(); volumeNode.gain.value = volume / 100;
        source.connect(filter); filter.connect(volumeNode); volumeNode.connect(context.destination); source.start();
        audio.current = context; gain.current = volumeNode;
      }
      await audio.current.resume();
      if (await onChange(true)) setPlaying(true);
      else { await audio.current.suspend(); setError(true); }
    } catch { setError(true); setPlaying(false); }
    finally { setStarting(false); }
  }
  const active = playing && enabled;
  return <section className={`ambient-player ${active ? 'is-playing' : ''}`} aria-label="氛围声音">
    <div className="ambient-heading"><Headphones size={19} /><h3>让世界安静一点</h3></div>
    <div className="ambient-track"><span className="ambient-art"><Waves size={28} weight="light" /></span><div><strong>窗外的雨</strong><span>{active ? '此刻正在播放' : '一段柔和的白噪声'}</span></div><button className="ambient-play" type="button" onClick={() => void toggle()} disabled={starting} aria-label={active ? '暂停氛围音' : '播放氛围音'}>{active ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}</button></div>
    <div className="ambient-wave" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ height: `${6 + ((index * 17 + 5) % 20)}px`, animationDelay: `${index * -67}ms` }} />)}</div>
    <label className="volume-control"><SpeakerHigh size={17} /><span className="sr-only">氛围音音量</span><input type="range" min="0" max="100" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (gain.current && audio.current) gain.current.gain.setTargetAtTime(next / 100, audio.current.currentTime, 0.08); }} /><span>{volume}%</span></label>
    {error && <p className="inline-error" role="alert">暂时无法播放，请确认浏览器允许声音后重试。</p>}
    <p className="ambient-note">声音在设备上合成，点击后才会播放。</p>
  </section>;
}

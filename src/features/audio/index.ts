export type AmbientAudioStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'suspended' | 'unsupported' | 'error' | 'disposed';
export interface AmbientAudioState {
  status: AmbientAudioStatus;
  isPlaying: boolean;
  volume: number;
  error?: string;
}
export interface AmbientAudioOptions {
  volume?: number;
  contextFactory?: () => AudioContext;
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

const clampVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Locally synthesized ambience. Call initialize/play directly from a click or key gesture. */
export class AmbientAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private filter?: BiquadFilterNode;
  private voices: OscillatorNode[] = [];
  private listeners = new Set<(state: AmbientAudioState) => void>();
  private state: AmbientAudioState;
  private initialization?: Promise<void>;
  private desiredPlaying = false;
  private revision = 0;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private finishFade?: () => void;
  private readonly ownerDocument?: AmbientAudioOptions['document'];

  constructor(private readonly options: AmbientAudioOptions = {}) {
    this.state = { status: 'idle', isPlaying: false, volume: clampVolume(options.volume ?? 0.35) };
    this.ownerDocument = options.document ?? globalThis.document;
    // Construction is side-effect free: no audio context or listeners until a gesture.
  }

  getState(): AmbientAudioState { return { ...this.state }; }

  subscribe(listener: (state: AmbientAudioState) => void): () => void {
    if (this.state.status === 'disposed') return () => undefined;
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private update(status: AmbientAudioStatus, error?: string): void {
    this.state = { ...this.state, status, isPlaying: status === 'playing', error };
    for (const listener of this.listeners) {
      try { listener(this.getState()); } catch { /* One view cannot break the audio lifecycle. */ }
    }
  }

  private cancelFade(): void {
    clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    this.finishFade?.();
    this.finishFade = undefined;
  }

  private targetGain(value: number): void {
    if (!this.context || !this.master) return;
    const { gain } = this.master;
    const time = this.context.currentTime;
    // Hold the actual ramp value for interruptible fades, including rapid play/pause.
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(time);
    else { gain.cancelScheduledValues(time); gain.setValueAtTime(gain.value, time); }
    gain.setTargetAtTime(value, time, 0.12);
  }

  initialize(): Promise<void> {
    if (this.state.status === 'disposed') return Promise.reject(new Error('氛围音已关闭。'));
    if (this.initialization) return this.initialization;
    if (this.context?.state === 'closed') void this.releaseContext();
    if (this.context) return Promise.resolve();
    if (globalThis.navigator?.userActivation && !globalThis.navigator.userActivation.isActive) {
      return Promise.reject(new Error('请点击播放按钮以启用声音。'));
    }
    const AudioContextClass = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!this.options.contextFactory && !AudioContextClass) {
      this.update('unsupported', '当前浏览器不支持 Web Audio。');
      return Promise.reject(new Error('当前浏览器不支持 Web Audio。'));
    }
    try {
      const context = this.options.contextFactory ? this.options.contextFactory() : new AudioContextClass!();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.setValueAtTime(0, context.currentTime);
      this.filter = context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(700, context.currentTime);
      this.filter.Q.setValueAtTime(0.3, context.currentTime);
      this.filter.connect(this.master);
      this.master.connect(context.destination);
      // A quiet, original major-sixth pad; no samples or external recordings.
      [130.8128, 195.9977, 261.6256, 329.6276].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        oscillator.detune.setValueAtTime(index % 2 ? 3 : -3, context.currentTime);
        oscillator.connect(this.filter!);
        oscillator.start();
        this.voices.push(oscillator);
      });
      context.addEventListener('statechange', this.onContextState);
      this.ownerDocument?.addEventListener('visibilitychange', this.onVisibility);
      // resume is invoked synchronously within the gesture, before the first await.
      const revision = this.revision;
      this.initialization = context.resume().then(async () => {
        if (this.state.status === 'disposed') return;
        if (this.ownerDocument?.visibilityState === 'hidden') {
          await context.suspend();
          if (this.getState().status !== 'disposed') this.update('suspended');
        } else {
          if (!this.desiredPlaying) await context.suspend();
          if (revision === this.revision && this.getState().status !== 'disposed') this.update('ready');
        }
      }).catch(async () => {
        if (this.state.status !== 'disposed') {
          this.desiredPlaying = false;
          await this.releaseContext();
          if (this.getState().status !== 'disposed') this.update('error', '无法启用声音，请再次点击播放。');
        }
        throw new Error('无法启用声音，请再次点击播放。');
      }).finally(() => { this.initialization = undefined; });
      return this.initialization;
    } catch {
      return this.releaseContext().then(() => {
        if (this.state.status !== 'disposed') this.update('error', '无法启用声音，请再次点击播放。');
        throw new Error('无法启用声音，请再次点击播放。');
      });
    }
  }

  async play(): Promise<void> {
    const revision = ++this.revision;
    this.cancelFade();
    this.desiredPlaying = true;
    try {
      await this.initialize();
      if (revision !== this.revision || this.getState().status === 'disposed') return;
      if (this.ownerDocument?.visibilityState === 'hidden') {
        await this.context?.suspend();
        if (revision === this.revision) this.update('suspended');
        return;
      }
      await this.context?.resume();
      if (revision !== this.revision || !this.desiredPlaying || this.getState().status === 'disposed') return;
      this.targetGain(this.state.volume ** 2 * 0.1);
      this.update('playing');
    } catch (error) {
      if (revision === this.revision && this.state.status !== 'disposed') {
        this.desiredPlaying = false;
        if (this.state.status !== 'unsupported') this.update('error', '无法播放声音，请再次点击播放。');
      }
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.state.status === 'disposed') return;
    const revision = ++this.revision;
    this.desiredPlaying = false;
    this.cancelFade();
    this.targetGain(0);
    this.update('paused');
    if (!this.context) return;
    await new Promise<void>((resolve) => {
      this.finishFade = resolve;
      this.fadeTimer = setTimeout(() => { this.finishFade = undefined; this.fadeTimer = undefined; resolve(); }, 180);
    });
    if (revision !== this.revision || this.getState().status === 'disposed') return;
    try { await this.context?.suspend(); }
    catch { if (revision === this.revision) this.update('error', '声音暂停失败，请关闭氛围音后重试。'); }
  }

  setVolume(volume: number): void {
    if (this.state.status === 'disposed') return;
    this.state.volume = clampVolume(volume);
    if (this.desiredPlaying && this.state.status === 'playing') this.targetGain(this.state.volume ** 2 * 0.1);
    this.update(this.state.status, this.state.error);
  }

  private onContextState = (): void => {
    if (!this.context || this.state.status === 'disposed' || this.initialization) return;
    if (this.context.state === 'closed') {
      this.desiredPlaying = false;
      this.update('error', '声音已被浏览器关闭，请重新启用。');
    } else if (this.context.state !== 'running' && this.desiredPlaying) this.update('suspended');
  };

  private onVisibility = (): void => {
    if (!this.context || this.state.status === 'disposed') return;
    if (this.ownerDocument?.visibilityState === 'hidden') {
      const revision = ++this.revision;
      this.cancelFade();
      this.targetGain(0);
      this.update(this.desiredPlaying ? 'suspended' : 'paused');
      void this.context.suspend().catch(() => {
        if (revision === this.revision && this.state.status !== 'disposed') this.update('error', '浏览器未能暂停声音，请关闭氛围音。');
      });
    } else if (this.desiredPlaying) {
      void this.play().catch(() => { /* play exposes the retry state to subscribers. */ });
    }
  };

  private async releaseContext(): Promise<void> {
    this.ownerDocument?.removeEventListener('visibilitychange', this.onVisibility);
    const context = this.context;
    context?.removeEventListener('statechange', this.onContextState);
    for (const oscillator of this.voices) {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
    }
    this.voices = [];
    this.filter?.disconnect();
    this.master?.disconnect();
    this.filter = this.master = undefined;
    this.context = undefined;
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* Disconnected nodes can no longer play. */ }
    }
  }

  async dispose(): Promise<void> {
    if (this.state.status === 'disposed') return;
    ++this.revision;
    this.desiredPlaying = false;
    this.cancelFade();
    this.update('disposed');
    this.listeners.clear();
    await this.releaseContext();
  }
}

export function createAmbientAudioEngine(options?: AmbientAudioOptions): AmbientAudioEngine {
  return new AmbientAudioEngine(options);
}

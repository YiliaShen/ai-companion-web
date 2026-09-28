import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientAudioEngine } from './index';

const audioParam = () => ({
  value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), cancelAndHoldAtTime: vi.fn()
});
function audioHarness() {
  const events = new EventTarget();
  let visibilityState = 'visible';
  const document = {
    get visibilityState() { return visibilityState as DocumentVisibilityState; },
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events))
  };
  const master = { gain: audioParam(), connect: vi.fn(), disconnect: vi.fn() };
  const filter = { type: '', frequency: audioParam(), Q: audioParam(), connect: vi.fn(), disconnect: vi.fn() };
  const oscillators: Array<{ type: string; frequency: ReturnType<typeof audioParam>; detune: ReturnType<typeof audioParam>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    createGain: vi.fn(() => master), createBiquadFilter: vi.fn(() => filter),
    createOscillator: vi.fn(() => {
      const oscillator = { type: '', frequency: audioParam(), detune: audioParam(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(oscillator);
      return oscillator;
    }),
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
    addEventListener: vi.fn(), removeEventListener: vi.fn()
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const engine = new AmbientAudioEngine({ contextFactory: factory, document });
  return { engine, factory, context, master, filter, oscillators, document,
    visibility(value: DocumentVisibilityState) { visibilityState = value; events.dispatchEvent(new Event('visibilitychange')); }
  };
}
let engines: AmbientAudioEngine[];
beforeEach(() => { engines = []; vi.useFakeTimers(); });
afterEach(async () => {
  await Promise.all(engines.map((engine) => engine.dispose()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const setup = () => { const harness = audioHarness(); engines.push(harness.engine); return harness; };

describe('ambient audio lifecycle', () => {
  it('has no initialization or playback side effects until explicitly enabled', async () => {
    const { engine, factory, document, context, oscillators } = setup();
    expect(engine.getState()).toMatchObject({ status: 'idle', isPlaying: false, volume: 0.35 });
    expect(factory).not.toHaveBeenCalled();
    expect(document.addEventListener).not.toHaveBeenCalled();
    await engine.play();
    expect(factory).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalled();
    expect(engine.getState().status).toBe('playing');
    expect(oscillators).toHaveLength(4);
    expect(oscillators.every((oscillator) => oscillator.type === 'sine')).toBe(true);
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('requires a current user gesture when browser activation is available', async () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: false } });
    const { engine, factory } = setup();
    await expect(engine.play()).rejects.toThrow('点击');
    expect(factory).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { userActivation: { isActive: true } });
    await engine.play();
    expect(engine.getState().status).toBe('playing');
  });

  it('clamps volume and applies smooth gain changes without rebuilding nodes', async () => {
    const { engine, master, context } = setup();
    await engine.play();
    engine.setVolume(2);
    expect(engine.getState().volume).toBe(1);
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.1, 0, 0.12);
    engine.setVolume(-1);
    expect(engine.getState().volume).toBe(0);
    engine.setVolume(Number.NaN);
    expect(engine.getState().volume).toBe(0);
    expect(context.createGain).toHaveBeenCalledOnce();
  });

  it('suspends when hidden and resumes only previously requested playback', async () => {
    const { engine, visibility, context } = setup();
    await engine.play();
    visibility('hidden');
    expect(engine.getState()).toMatchObject({ status: 'suspended', isPlaying: false });
    expect(context.suspend).toHaveBeenCalled();
    visibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getState().status).toBe('playing');
    const paused = engine.pause();
    await vi.advanceTimersByTimeAsync(180);
    await paused;
    expect(engine.getState().status).toBe('paused');
    const resumeCount = context.resume.mock.calls.length;
    visibility('hidden'); visibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(context.resume).toHaveBeenCalledTimes(resumeCount);
  });

  it('does not create a second graph on rapid play-pause-play, or let a stale fade suspend it', async () => {
    const { engine, context, factory } = setup();
    await engine.play();
    const pause = engine.pause();
    await engine.play();
    await pause;
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.getState().status).toBe('playing');
    expect(context.state).toBe('running');
    expect(factory).toHaveBeenCalledOnce();
  });

  it('stops oscillators, closes the context and removes listeners/timers on cleanup', async () => {
    const { engine, context, oscillators, document, master, filter } = setup();
    const subscriber = vi.fn();
    engine.subscribe(subscriber);
    await engine.play();
    const pause = engine.pause();
    await engine.dispose();
    await pause;
    await engine.dispose();
    expect(engine.getState().status).toBe('disposed');
    expect(context.close).toHaveBeenCalledOnce();
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1 && oscillator.disconnect.mock.calls.length === 1)).toBe(true);
    expect(master.disconnect).toHaveBeenCalledOnce();
    expect(filter.disconnect).toHaveBeenCalledOnce();
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    const notifications = subscriber.mock.calls.length;
    engine.setVolume(0.5);
    await expect(engine.play()).rejects.toThrow('已关闭');
    expect(subscriber).toHaveBeenCalledTimes(notifications);
  });

  it('cannot resurrect playback when a pending resume resolves after disposal', async () => {
    const { engine, context } = setup();
    let finishResume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>((resolve) => { finishResume = resolve; }));
    const playing = engine.play();
    await engine.dispose();
    finishResume();
    await playing;
    expect(engine.getState().status).toBe('disposed');
  });

  it('keeps a paused session suspended if an earlier initialization completes late', async () => {
    const { engine, context } = setup();
    let finishResume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishResume = () => { context.state = 'running'; resolve(); };
    }));
    const playing = engine.play();
    const paused = engine.pause();
    await vi.advanceTimersByTimeAsync(180);
    await paused;
    finishResume();
    await playing;
    expect(engine.getState().status).toBe('paused');
    expect(context.state).toBe('suspended');
  });

  it('releases a failed graph and allows a new user-initiated retry', async () => {
    const { engine, context, factory } = setup();
    context.resume.mockRejectedValueOnce(new Error('autoplay denied'));
    await expect(engine.play()).rejects.toThrow('无法启用');
    expect(engine.getState()).toMatchObject({ status: 'error', isPlaying: false });
    expect(context.close).toHaveBeenCalledOnce();
    await engine.play();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(engine.getState().status).toBe('playing');
  });

  it('reports unsupported browsers without throwing on construction or disposal', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    const engine = new AmbientAudioEngine();
    engines.push(engine);
    await expect(engine.play()).rejects.toThrow('不支持');
    expect(engine.getState().status).toBe('unsupported');
    await engine.dispose();
    expect(engine.getState().status).toBe('disposed');
  });
});

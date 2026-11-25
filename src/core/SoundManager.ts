import type { EventBus } from './EventBus';
import type { StorageAdapter } from './types';

const MUTE_STORAGE_KEY = 'locus-zero:audio-muted';

export interface SoundManagerOptions {
  bus: EventBus;
  storage: StorageAdapter;
}

/**
 * Gerenciador de áudio desacoplado das Engines:
 * - Tenta carregar trilha MP3 específica da fase em ./audio/ambient-<levelId>.mp3
 * - Fallback procedural: ambientação fluida/amniótica calma via Web Audio API
 * - Efeitos procedurais orgânicos (síntese subtrativa com filtros e envelopes suaves)
 */
export class SoundManager {
  private readonly storage: StorageAdapter;
  private readonly unsubscribers: Array<() => void> = [];

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private unlocked = false;
  private currentLevelId: string | null = null;
  private activeAmbientCleanup: (() => void) | null = null;
  private readonly mp3BufferCache = new Map<string, AudioBuffer | null>();

  constructor(options: SoundManagerOptions) {
    this.storage = options.storage;
    this.muted = this.storage.getItem(MUTE_STORAGE_KEY) === 'true';

    this.unsubscribers.push(
      options.bus.on('interaction:scan', () => {
        this.playScan();
      }),
      options.bus.on('interaction:selection-changed', ({ moleculeId }) => {
        if (moleculeId) {
          this.playSoftSelect();
        }
      }),
      options.bus.on('feedback:action', (feedback) => {
        this.playForFeedbackCode(feedback.eventCode, feedback.valid);
      }),
      options.bus.on('level:completed', () => {
        this.playSuccess();
      }),
    );
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.storage.setItem(MUTE_STORAGE_KEY, this.muted ? 'true' : 'false');
    this.syncMasterGain();
    if (!this.muted && !this.unlocked) {
      void this.unlock();
    }
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.ambientGain.gain.value = 0.22;
      this.sfxGain.gain.value = 0.55;

      this.ambientGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncMasterGain(true);
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }

    this.unlocked = true;
    if (this.currentLevelId && !this.activeAmbientCleanup) {
      void this.startAmbientForLevel(this.currentLevelId);
    }
  }

  setLevel(levelId: string): void {
    if (this.currentLevelId === levelId && this.activeAmbientCleanup) return;
    this.currentLevelId = levelId;
    if (this.unlocked) {
      void this.startAmbientForLevel(levelId);
    }
  }

  setDucking(ducked: boolean): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const target = ducked ? 0.09 : 0.22;
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setTargetAtTime(target, now, 0.25);
  }

  playForFeedbackCode(eventCode: string, valid: boolean): void {
    switch (eventCode) {
      case 'LACTOSE_INFLUX':
      case 'GLUCOSE_DROP':
        this.playChannelOpen();
        break;
      case 'LACTOSE_CLOSED':
      case 'GLUCOSE_CLOSED':
        this.playChannelClose();
        break;
      case 'ALLOSTERIC_SHIFT':
        this.playUnlock();
        break;
      case 'COMPLEX_FORMED':
        this.playCraft();
        break;
      case 'CAP_CAMP_BOUND':
        this.playLock();
        break;
      case 'TRANSCRIPTION_BASAL':
        this.playLock();
        break;
      case 'TRANSCRIPTION_HIGH':
        this.playSuccess();
        break;
      case 'BUMP_REPRESSOR':
        this.playBump();
        break;
      default:
        if (!valid) {
          this.playSoftReject();
        }
        break;
    }
  }

  playScan(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(ctx, { freq: 587.33, endFreq: 587.33, duration: 0.22, gain: 0.14, type: 'sine', start: now });
    this.playTone(ctx, { freq: 880, endFreq: 880, duration: 0.28, gain: 0.1, type: 'sine', start: now + 0.05 });
  }

  playSoftSelect(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(ctx, { freq: 440, endFreq: 520, duration: 0.09, gain: 0.08, type: 'sine', start: now });
  }

  playLock(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Transiente tátil curto + pulso grave de encaixe chave-fechadura
    this.playFilteredNoise(ctx, { freq: 920, q: 3.2, duration: 0.045, gain: 0.18, start: now });
    this.playTone(ctx, { freq: 190, endFreq: 92, duration: 0.11, gain: 0.24, type: 'triangle', start: now });
    this.playTone(ctx, { freq: 523.25, endFreq: 523.25, duration: 0.18, gain: 0.08, type: 'sine', start: now + 0.03 });
  }

  playUnlock(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playFilteredNoise(ctx, { freq: 650, endFreq: 1400, q: 1.8, duration: 0.18, gain: 0.1, start: now });
    this.playTone(ctx, { freq: 392, endFreq: 440, duration: 0.16, gain: 0.13, type: 'sine', start: now });
    this.playTone(ctx, { freq: 587.33, endFreq: 659.25, duration: 0.22, gain: 0.12, type: 'sine', start: now + 0.07 });
  }

  playChannelOpen(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playFilteredNoise(ctx, { freq: 340, endFreq: 1180, q: 2.0, duration: 0.28, gain: 0.16, start: now });
    this.playTone(ctx, { freq: 260, endFreq: 480, duration: 0.22, gain: 0.11, type: 'sine', start: now + 0.02 });
  }

  playChannelClose(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playFilteredNoise(ctx, { freq: 980, endFreq: 260, q: 2.2, duration: 0.22, gain: 0.14, start: now });
    this.playTone(ctx, { freq: 220, endFreq: 110, duration: 0.14, gain: 0.16, type: 'triangle', start: now + 0.05 });
  }

  playCraft(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(ctx, { freq: 440, endFreq: 440, duration: 0.34, gain: 0.11, type: 'sine', start: now });
    this.playTone(ctx, { freq: 554.37, endFreq: 554.37, duration: 0.34, gain: 0.1, type: 'sine', start: now + 0.04 });
    this.playTone(ctx, { freq: 659.25, endFreq: 659.25, duration: 0.42, gain: 0.11, type: 'sine', start: now + 0.08 });
  }

  playBump(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(ctx, { freq: 110, endFreq: 48, duration: 0.16, gain: 0.28, type: 'sine', start: now });
    this.playFilteredNoise(ctx, { freq: 280, q: 1.2, duration: 0.09, gain: 0.14, start: now });
  }

  playSoftReject(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(ctx, { freq: 220, endFreq: 170, duration: 0.16, gain: 0.12, type: 'triangle', start: now });
  }

  playSuccess(): void {
    const ctx = this.readyCtx();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(ctx, {
        freq,
        endFreq: freq,
        duration: idx === notes.length - 1 ? 0.55 : 0.28,
        gain: 0.11,
        type: 'sine',
        start: now + idx * 0.08,
      });
    });
  }

  destroy(): void {
    this.stopAmbient();
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private readyCtx(): AudioContext | null {
    if (this.muted || !this.unlocked || !this.ctx) return null;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private syncMasterGain(immediate = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : 1;
    this.masterGain.gain.cancelScheduledValues(now);
    if (immediate) {
      this.masterGain.gain.setValueAtTime(target, now);
    } else {
      this.masterGain.gain.setTargetAtTime(target, now, 0.08);
    }
  }

  private stopAmbient(): void {
    if (this.activeAmbientCleanup) {
      this.activeAmbientCleanup();
      this.activeAmbientCleanup = null;
    }
  }

  private async startAmbientForLevel(levelId: string): Promise<void> {
    this.stopAmbient();
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;

    const url = `./audio/ambient-${levelId}.mp3`;
    const buffer = await this.loadMp3Buffer(ctx, url);

    // Garante que ainda estamos na mesma fase após o fetch assíncrono
    if (this.currentLevelId !== levelId || !this.ctx || !this.ambientGain) return;

    if (buffer) {
      this.startMp3Loop(ctx, buffer);
    } else {
      this.startProceduralFluidAmbient(ctx);
    }
  }

  private async loadMp3Buffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    if (this.mp3BufferCache.has(url)) {
      return this.mp3BufferCache.get(url) ?? null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.mp3BufferCache.set(url, null);
        return null;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        this.mp3BufferCache.set(url, null);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      this.mp3BufferCache.set(url, decoded);
      return decoded;
    } catch {
      this.mp3BufferCache.set(url, null);
      return null;
    }
  }

  private startMp3Loop(ctx: AudioContext, buffer: AudioBuffer): void {
    if (!this.ambientGain) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const fade = ctx.createGain();
    const now = ctx.currentTime;
    fade.gain.setValueAtTime(0.0001, now);
    fade.gain.exponentialRampToValueAtTime(1, now + 1.5);

    source.connect(fade);
    fade.connect(this.ambientGain);
    source.start(now);

    this.activeAmbientCleanup = () => {
      try {
        source.stop();
        source.disconnect();
        fade.disconnect();
      } catch {
        // Ignora se já parado
      }
    };
  }

  /**
   * Fallback procedural: simula ambiente líquido/amniótico tranquilo do citoplasma
   * usando ruído rosa filtrado com LFO lento (~11s) + drone sub-harmônico muito suave.
   */
  private startProceduralFluidAmbient(ctx: AudioContext): void {
    if (!this.ambientGain) return;
    const now = ctx.currentTime;

    const fluidGain = ctx.createGain();
    fluidGain.gain.setValueAtTime(0.0001, now);
    fluidGain.gain.exponentialRampToValueAtTime(1, now + 1.8);
    fluidGain.connect(this.ambientGain);

    // 1. Camada líquida: ruído filtrado por passa-baixa com LFO lento simulando corrente calma
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getPinkNoiseBuffer(ctx);
    noiseSource.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(210, now);
    lowpass.Q.setValueAtTime(1.4, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.09, now); // Ciclo calmo de ~11 segundos

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(85, now);

    const noiseLevel = ctx.createGain();
    noiseLevel.gain.setValueAtTime(0.24, now);

    lfo.connect(lfoDepth);
    lfoDepth.connect(lowpass.frequency);
    noiseSource.connect(lowpass);
    lowpass.connect(noiseLevel);
    noiseLevel.connect(fluidGain);

    // 2. Camada sub-harmônica abafada (sensação orgânica de imersão celular)
    const droneA = ctx.createOscillator();
    droneA.type = 'sine';
    droneA.frequency.setValueAtTime(65.41, now); // C2 suave

    const droneB = ctx.createOscillator();
    droneB.type = 'sine';
    droneB.frequency.setValueAtTime(98.0, now); // G2 suave

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.06, now);

    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(fluidGain);

    noiseSource.start(now);
    lfo.start(now);
    droneA.start(now);
    droneB.start(now);

    this.activeAmbientCleanup = () => {
      try {
        noiseSource.stop();
        lfo.stop();
        droneA.stop();
        droneB.stop();
        fluidGain.disconnect();
      } catch {
        // Ignora se já parado
      }
    };
  }

  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }

    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Filtro simples de Paul Kellet para ruído rosa suave (sem chiado agudo)
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private playTone(
    ctx: AudioContext,
    opts: {
      freq: number;
      endFreq: number;
      duration: number;
      gain: number;
      type: OscillatorType;
      start: number;
    },
  ): void {
    if (!this.sfxGain) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, opts.start);
    if (opts.endFreq !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), opts.start + opts.duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, opts.start);

    env.gain.setValueAtTime(0.0001, opts.start);
    env.gain.linearRampToValueAtTime(opts.gain, opts.start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(opts.start);
    osc.stop(opts.start + opts.duration + 0.02);
  }

  private playFilteredNoise(
    ctx: AudioContext,
    opts: {
      freq: number;
      endFreq?: number;
      q: number;
      duration: number;
      gain: number;
      start: number;
    },
  ): void {
    if (!this.sfxGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getPinkNoiseBuffer(ctx);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opts.freq, opts.start);
    if (opts.endFreq && opts.endFreq !== opts.freq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), opts.start + opts.duration);
    }
    filter.Q.setValueAtTime(opts.q, opts.start);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, opts.start);
    env.gain.linearRampToValueAtTime(opts.gain, opts.start + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    src.start(opts.start);
    src.stop(opts.start + opts.duration + 0.02);
  }
}

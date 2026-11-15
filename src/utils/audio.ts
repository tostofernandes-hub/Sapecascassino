/**
 * Audio Synthesizer utilizing Web Audio API without any external assets.
 * Supports independent Background Music (soft casino lounge) and Sound Effects (SFX)
 * preferences persisted in localStorage, plus live subscriber synchronization.
 */

const MUSIC_STORAGE_KEY = 'sapecas_music_enabled';
const SFX_STORAGE_KEY = 'sapecas_sfx_enabled';
const LEGACY_MUTE_KEY = 'casino_sound_muted';

class SoundManager {
  private ctx: AudioContext | null = null;
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private listeners: Set<() => void> = new Set();

  // Ambient Lounge Music scheduler state
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private musicMasterGain: GainNode | null = null;
  private musicChordIndex: number = 0;
  private isMusicPlaying: boolean = false;
  private gestureHooked: boolean = false;

  // Lush soft casino lounge progression (Cmaj9 -> Am9 -> Fmaj7 -> G6)
  private readonly loungeChords: number[][] = [
    [130.81, 196.00, 246.94, 293.66, 329.63], // Cmaj9
    [110.00, 164.81, 246.94, 261.63, 329.63], // Am9
    [87.31, 174.61, 220.00, 261.63, 329.63],  // Fmaj7
    [98.00, 196.00, 246.94, 293.66, 329.63],  // G6
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMusic = localStorage.getItem(MUSIC_STORAGE_KEY);
      const savedSfx = localStorage.getItem(SFX_STORAGE_KEY);
      const legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY);

      if (savedMusic !== null) {
        this.musicEnabled = savedMusic === 'true';
      } else if (legacyMuted !== null) {
        this.musicEnabled = legacyMuted !== 'true';
      }

      if (savedSfx !== null) {
        this.sfxEnabled = savedSfx === 'true';
      } else if (legacyMuted !== null) {
        this.sfxEnabled = legacyMuted !== 'true';
      }

      this.setupFirstGestureUnlock();
    }
  }

  private setupFirstGestureUnlock() {
    if (this.gestureHooked || typeof window === 'undefined') return;
    this.gestureHooked = true;

    const unlock = () => {
      this.initContext();
      if (this.musicEnabled && !this.isMusicPlaying) {
        this.startBackgroundMusic();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private persistPreferences() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MUSIC_STORAGE_KEY, String(this.musicEnabled));
    localStorage.setItem(SFX_STORAGE_KEY, String(this.sfxEnabled));
    localStorage.setItem(LEGACY_MUTE_KEY, String(!this.sfxEnabled && !this.musicEnabled));
  }

  // ---------------- MUSIC CONTROLS ----------------

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(enabled: boolean): boolean {
    this.musicEnabled = enabled;
    this.persistPreferences();
    if (enabled) {
      this.initContext();
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }
    this.notify();
    return this.musicEnabled;
  }

  public toggleMusic(): boolean {
    return this.setMusicEnabled(!this.musicEnabled);
  }

  private playLoungeChord() {
    if (!this.musicEnabled || !this.ctx || !this.musicMasterGain) return;
    if (this.ctx.state === 'suspended') return;

    try {
      const now = this.ctx.currentTime;
      const chord = this.loungeChords[this.musicChordIndex % this.loungeChords.length];
      this.musicChordIndex++;

      const duration = 3.1;

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.musicMasterGain) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(idx === 0 ? 340 : 680, now);

        const peak = idx === 0 ? 0.24 : 0.11;
        const offset = idx * 0.06;

        noteGain.gain.setValueAtTime(0.0001, now + offset);
        noteGain.gain.linearRampToValueAtTime(peak, now + offset + 0.45);
        noteGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.musicMasterGain);

        osc.start(now + offset);
        osc.stop(now + duration + 0.05);
      });
    } catch {
      // Ignore Web Audio edge errors
    }
  }

  public startBackgroundMusic() {
    if (!this.musicEnabled || this.isMusicPlaying) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      if (!this.musicMasterGain) {
        this.musicMasterGain = this.ctx.createGain();
        this.musicMasterGain.connect(this.ctx.destination);
      }
      this.musicMasterGain.gain.cancelScheduledValues(now);
      this.musicMasterGain.gain.setValueAtTime(0.0001, now);
      this.musicMasterGain.gain.linearRampToValueAtTime(0.055, now + 0.8);

      this.isMusicPlaying = true;
      this.playLoungeChord();
      this.musicInterval = setInterval(() => {
        if (this.musicEnabled) {
          this.playLoungeChord();
        }
      }, 2800);
    } catch {
      this.isMusicPlaying = false;
    }
  }

  public stopBackgroundMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.ctx && this.musicMasterGain) {
      try {
        const now = this.ctx.currentTime;
        this.musicMasterGain.gain.cancelScheduledValues(now);
        this.musicMasterGain.gain.setValueAtTime(this.musicMasterGain.gain.value, now);
        this.musicMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      } catch {
        // Ignore ramp error
      }
    }
    this.isMusicPlaying = false;
  }

  // ---------------- SFX CONTROLS ----------------

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setSfxEnabled(enabled: boolean): boolean {
    this.sfxEnabled = enabled;
    this.persistPreferences();
    if (enabled) {
      this.playClick();
    }
    this.notify();
    return this.sfxEnabled;
  }

  public toggleSfx(): boolean {
    return this.setSfxEnabled(!this.sfxEnabled);
  }

  // ---------------- GLOBAL MUTE COMPATIBILITY ----------------

  public getMuted(): boolean {
    return !this.sfxEnabled && !this.musicEnabled;
  }

  public toggleMute(): boolean {
    const currentlyMuted = this.getMuted();
    const nextEnabled = currentlyMuted;
    this.musicEnabled = nextEnabled;
    this.sfxEnabled = nextEnabled;
    this.persistPreferences();
    if (nextEnabled) {
      this.initContext();
      this.startBackgroundMusic();
      this.playClick();
    } else {
      this.stopBackgroundMusic();
    }
    this.notify();
    return this.getMuted();
  }

  public setMuted(muted: boolean) {
    this.musicEnabled = !muted;
    this.sfxEnabled = !muted;
    this.persistPreferences();
    if (muted) {
      this.stopBackgroundMusic();
    } else {
      this.initContext();
      this.startBackgroundMusic();
    }
    this.notify();
  }

  /**
   * Generic tone helper (SFX)
   */
  private playTone(freq: number, type: OscillatorType, duration: number, startVol = 0.15, endVol = 0.001, startTime = 0) {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime + startTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(startVol, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, endVol), now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio playback fails gracefully if blocked by autoplay policy
    }
  }

  /**
   * Crisp UI click sound
   */
  public playClick() {
    this.playTone(600, 'triangle', 0.05, 0.1, 0.01);
  }

  /**
   * Sound of adding a chip to a bet
   */
  public playChip() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    this.playTone(1800, 'sine', 0.03, 0.08, 0.005, 0);
    this.playTone(2400, 'sine', 0.04, 0.06, 0.005, 0.02);
  }

  /**
   * Card deal swoosh / flick
   */
  public playCardDeal() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
    } catch {
      this.playTone(400, 'triangle', 0.04, 0.08, 0.01);
    }
  }

  /**
   * Shuffling deck sound
   */
  public playShuffle() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.playCardDeal(), i * 45);
    }
  }

  /**
   * Roulette wheel ball tick (single ball bounce on pocket)
   */
  public playRouletteTick(pitch = 1200) {
    this.playTone(pitch, 'sine', 0.03, 0.09, 0.005);
  }

  /**
   * Slot machine reel spin tick
   */
  public playReelTick() {
    this.playTone(450, 'square', 0.02, 0.04, 0.005);
  }

  /**
   * Slot machine reel stop clunk
   */
  public playReelStop() {
    this.playTone(280, 'triangle', 0.08, 0.15, 0.01);
    this.playTone(140, 'sine', 0.1, 0.1, 0.01);
  }

  /**
   * 3D Dice roll rattling tick
   */
  public playDiceTick(pitch = 1000) {
    this.playTone(pitch + Math.random() * 400, 'sine', 0.03, 0.07, 0.005);
  }

  /**
   * 3D Dice solid landing impact on casino felt table
   */
  public playDiceThud() {
    this.playTone(170, 'triangle', 0.12, 0.22, 0.01);
    this.playTone(95, 'sine', 0.16, 0.15, 0.01);
  }

  /**
   * Round victory arpeggio (C major / bright triad)
   */
  public playWin() {
    if (!this.sfxEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.22, 0.15, 0.01, idx * 0.07);
    });
  }

  /**
   * Round loss gentle tone (descending, non-punishing)
   */
  public playLoss() {
    if (!this.sfxEnabled) return;
    this.playTone(330, 'triangle', 0.15, 0.08, 0.01, 0);
    this.playTone(260, 'sine', 0.25, 0.07, 0.01, 0.12);
  }

  /**
   * Sound of lottery sphere rolling down the 3D chute and docking
   */
  public playChuteDrop() {
    if (!this.sfxEnabled) return;
    this.playTone(880, 'triangle', 0.05, 0.12, 0.01, 0);
    this.playTone(520, 'sine', 0.09, 0.15, 0.005, 0.035);
  }

  /**
   * Grand Jackpot fanfare!
   */
  public playJackpot() {
    if (!this.sfxEnabled) return;
    const notes = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.08 },
      { f: 783.99, t: 0.16 },
      { f: 1046.5, t: 0.24 },
      { f: 783.99, t: 0.36 },
      { f: 1046.5, t: 0.44 },
      { f: 1318.51, t: 0.52 },
      { f: 1567.98, t: 0.64 }
    ];
    notes.forEach(({ f, t }) => {
      this.playTone(f, 'triangle', 0.3, 0.18, 0.01, t);
    });
  }

  /**
   * Fast crisp coin / chip increment ping during number count-up
   */
  public playCoinTally(pitch = 1200) {
    if (!this.sfxEnabled) return;
    this.playTone(pitch, 'sine', 0.035, 0.08, 0.002);
  }

  /**
   * Impact chime when a high multiplier (e.g. 36x) is revealed
   */
  public playMultiplierHit() {
    if (!this.sfxEnabled) return;
    this.playTone(440, 'triangle', 0.25, 0.2, 0.01, 0);
    this.playTone(880, 'sine', 0.3, 0.25, 0.01, 0.05);
    this.playTone(1320, 'sine', 0.4, 0.3, 0.01, 0.1);
    this.playTone(1760, 'sine', 0.5, 0.2, 0.005, 0.15);
  }

  /**
   * Sound of roulette ball clattering into a pocket
   */
  public playBallDrop() {
    if (!this.sfxEnabled) return;
    this.playTone(320, 'triangle', 0.06, 0.15, 0.01, 0);
    this.playTone(560, 'sine', 0.05, 0.12, 0.01, 0.03);
    this.playTone(840, 'sine', 0.07, 0.1, 0.005, 0.07);
  }

  /**
   * Miner bomb detonation explosion
   */
  public playExplosion() {
    if (!this.sfxEnabled) return;
    this.playTone(110, 'sawtooth', 0.4, 0.3, 0.01, 0);
    this.playTone(85, 'sawtooth', 0.5, 0.25, 0.01, 0.05);
    this.playTone(60, 'sine', 0.6, 0.2, 0.001, 0.1);
  }

  /**
   * Plinko ball bounce on wooden pin
   */
  public playPlinkoPeg(pitch = 1400) {
    if (!this.sfxEnabled) return;
    this.playTone(pitch, 'triangle', 0.025, 0.08, 0.005);
  }

  /**
   * Liar's Bar challenge fanfare / bluff reveal
   */
  public playBluffCall() {
    if (!this.sfxEnabled) return;
    this.playTone(392, 'sawtooth', 0.12, 0.15, 0.01, 0);
    this.playTone(523.25, 'sawtooth', 0.25, 0.18, 0.01, 0.1);
  }

  /**
   * Russian Roulette: dry-fire hammer click on empty chamber
   */
  public playDryFireClick() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    this.playTone(2200, 'square', 0.025, 0.14, 0.002, 0);
    this.playTone(950, 'triangle', 0.04, 0.12, 0.002, 0.015);
    this.playTone(320, 'sine', 0.035, 0.06, 0.002, 0.02);
  }

  /**
   * Russian Roulette: real revolver gunshot (noise burst + sub punch)
   */
  public playGunshot() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 0.48;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const decay = Math.pow(1 - i / bufferSize, 2.2);
        data[i] = (Math.random() * 2 - 1) * decay;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3800, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.36);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);

      // Low-end concussive punch
      const osc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.24);
      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(subGain);
      subGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    } catch {
      this.playTone(90, 'sawtooth', 0.35, 0.35, 0.005);
    }
  }
}

export const soundManager = new SoundManager();

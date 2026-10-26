'use client';

import type { GameSettings } from '@shared/index';
type AudioSettings = Pick<GameSettings, 'sound' | 'music' | 'volume'>;
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | undefined;
let master: GainNode | undefined;
let effects: GainNode | undefined;
let music: GainNode | undefined;
let muted = false;
let unlocked = false;
let listenersInstalled = false;
let options: AudioSettings = { sound: true, music: false, volume: 0.4 };
let musicRequested = false;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let nextNoteAt = 0;
let musicStep = 0;
const musicVoices = new Set<AudioScheduledSourceNode>();
const effectVoices = new Set<AudioScheduledSourceNode>();
let noiseBuffer: AudioBuffer | undefined;

function stopVoices(voices: Set<AudioScheduledSourceNode>) {
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {
      /* A finished voice is already quiet. */
    }
  }
  voices.clear();
}

function trackVoice(
  source: AudioScheduledSourceNode,
  bus: 'music' | 'effects',
  nodes: AudioNode[],
) {
  const voices = bus === 'music' ? musicVoices : effectVoices;
  voices.add(source);
  source.onended = () => {
    voices.delete(source);
    source.disconnect();
    nodes.forEach((node) => node.disconnect());
  };
}

function noise() {
  if (!context) return;
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let seed = 41793;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296) * 2 - 1;
    }
  }
  return noiseBuffer;
}

function percussion(
  at: number,
  kind: 'kick' | 'clap' | 'hat',
  level: number,
  bus: 'music' | 'effects' = 'music',
) {
  if (!context || !music || !effects) return;
  const envelope = context.createGain();
  const destination = bus === 'music' ? music : effects;
  envelope.connect(destination);
  if (kind === 'kick') {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(145, at);
    oscillator.frequency.exponentialRampToValueAtTime(46, at + 0.14);
    envelope.gain.setValueAtTime(level, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    oscillator.connect(envelope);
    trackVoice(oscillator, bus, [envelope]);
    oscillator.start(at);
    oscillator.stop(at + 0.22);
  } else {
    const source = context.createBufferSource();
    source.buffer = noise()!;
    const filter = context.createBiquadFilter();
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'hat' ? 7000 : 1550;
    filter.Q.value = kind === 'hat' ? 0.5 : 0.8;
    source.connect(filter);
    filter.connect(envelope);
    const duration = kind === 'hat' ? 0.07 : 0.17;
    envelope.gain.setValueAtTime(level, at);
    if (kind === 'clap') {
      envelope.gain.exponentialRampToValueAtTime(0.002, at + 0.012);
      envelope.gain.setValueAtTime(level * 0.8, at + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.002, at + 0.035);
      envelope.gain.setValueAtTime(level * 0.6, at + 0.045);
    }
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    trackVoice(source, bus, [filter, envelope]);
    source.start(at, (musicStep * 0.037) % 1.4);
    source.stop(at + duration + 0.015);
  }
}

// A short synthetic applause/cheer texture, not a voice recording.
function crowdCheer(celebration: boolean) {
  if (!context || !effects) return;
  const at = context.currentTime + 0.025;
  const duration = celebration ? 1.8 : 0.8;
  for (let i = 0; i < (celebration ? 14 : 6); i++) {
    percussion(at + i * 0.105 + (i % 3) * 0.014, 'clap', 0.032 + (i % 3) * 0.008, 'effects');
  }
  for (let i = 0; i < 3; i++) {
    const voice = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const start = at + i * 0.11;
    voice.type = 'triangle';
    voice.frequency.setValueAtTime(330 + i * 37, start);
    voice.frequency.exponentialRampToValueAtTime(510 + i * 55, start + 0.25);
    voice.frequency.exponentialRampToValueAtTime(400 + i * 30, start + duration * 0.85);
    filter.type = 'bandpass';
    filter.frequency.value = 850 + i * 150;
    filter.Q.value = 1.1;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.035, start + 0.12);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    voice.connect(filter);
    filter.connect(envelope);
    envelope.connect(effects);
    trackVoice(voice, 'effects', [filter, envelope]);
    voice.start(start);
    voice.stop(start + duration + 0.02);
  }
}

const tones: Record<string, number[]> = {
  click: [620],
  select: [440, 660],
  ready: [440, 554, 660],
  join: [520, 700],
  countdown: [440],
  start: [330, 440, 660, 880],
  answer: [620, 820],
  correct: [523, 659, 784],
  wrong: [240, 180],
  pull: [160, 200],
  slide: [200, 150, 120],
  victory: [523, 659, 784, 1047],
  defeat: [392, 330, 262],
};

function applyVolume() {
  if (!master || !context) return;
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setTargetAtTime(muted ? 0 : options.volume, context.currentTime, 0.035);
}

function stopSequence() {
  if (musicTimer !== undefined) clearInterval(musicTimer);
  musicTimer = undefined;
  stopVoices(musicVoices);
  musicStep = 0;
  nextNoteAt = 0;
}

function note(frequency: number, at: number, duration: number, level: number, bass = false) {
  if (!context || !music) return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = bass ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(frequency, at);
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(level, at + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope);
  envelope.connect(music);
  trackVoice(oscillator, 'music', [envelope]);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.025);
}

// Original 128 BPM stadium-pop loop. All instruments are synthesized locally.
const melody = [
  72, 76, 79, -1, 79, 76, 74, 76, 69, 72, 76, -1, 81, 79, 76, -1, 77, 76, 72, 77, 81, -1, 79, 77,
  74, 79, 83, 79, 86, 83, 79, -1,
];
const bassLine = [48, 45, 41, 43];
const chords = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const frequencyFor = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
function scheduleMusic() {
  if (!context || context.state !== 'running') return;
  const stepSeconds = 60 / 128 / 2;
  if (nextNoteAt < context.currentTime) nextNoteAt = context.currentTime + 0.035;
  while (nextNoteAt < context.currentTime + 0.35) {
    const index = musicStep % melody.length;
    const bar = Math.floor(index / 8);
    const beat = index % 8;
    if (melody[index] >= 0) note(frequencyFor(melody[index]), nextNoteAt, 0.19, 0.057);
    if (beat % 2 === 0) {
      percussion(nextNoteAt, 'kick', 0.13);
      note(frequencyFor(bassLine[bar] + (beat === 6 ? 12 : 0)), nextNoteAt, 0.32, 0.085, true);
    }
    percussion(nextNoteAt, 'hat', beat % 2 ? 0.025 : 0.016);
    if (beat === 2 || beat === 6) percussion(nextNoteAt, 'clap', 0.075);
    if (beat === 0 || beat === 4) {
      for (const pitch of chords[bar]) note(frequencyFor(pitch), nextNoteAt, 0.42, 0.018);
    }
    nextNoteAt += stepSeconds;
    musicStep += 1;
  }
}

function startMusic() {
  if (
    !unlocked ||
    !context ||
    context.state !== 'running' ||
    muted ||
    !musicRequested ||
    !options.music ||
    options.volume <= 0 ||
    document.hidden ||
    musicTimer !== undefined
  )
    return;
  nextNoteAt = context.currentTime + 0.04;
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 180);
}

async function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!context) {
      const AudioConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioConstructor) return;
      context = new AudioConstructor();
      master = context.createGain();
      effects = context.createGain();
      music = context.createGain();
      effects.connect(master);
      music.connect(master);
      master.connect(context.destination);
      master.gain.value = muted ? 0 : options.volume;
    }
    // Called only from pointer, touch, or keyboard gestures, never a server event.
    if (context.state === 'suspended') await context.resume();
    unlocked = context.state === 'running';
    startMusic();
  } catch {
    /* Denied playback must never interrupt gameplay. */
  }
}

function ensureGestureListeners() {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;
  const gesture = () => {
    void unlockAudio();
  };
  window.addEventListener('pointerdown', gesture, { passive: true });
  window.addEventListener('touchend', gesture, { passive: true });
  window.addEventListener('keydown', gesture);
  window.addEventListener('pagehide', () => {
    stopSequence();
    stopVoices(effectVoices);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSequence();
      stopVoices(effectVoices);
    } else startMusic();
  });
}

/** Apply room defaults without creating an AudioContext or bypassing autoplay rules. */
export function configureAudio(settings: Partial<AudioSettings>) {
  options = {
    sound: settings.sound ?? options.sound,
    music: settings.music ?? options.music,
    volume:
      typeof settings.volume === 'number' && Number.isFinite(settings.volume)
        ? Math.max(0, Math.min(1, settings.volume))
        : options.volume,
  };
  musicRequested = options.music;
  ensureGestureListeners();
  applyVolume();
  if (!options.sound || options.volume === 0) stopVoices(effectVoices);
  if (!musicRequested || options.volume === 0) stopSequence();
  else startMusic();
}

/** Cancel the background scheduler and its voices when leaving a match screen. */
export function stopMusic() {
  musicRequested = false;
  stopSequence();
  stopVoices(effectVoices);
}

export function setMuted(value: boolean) {
  muted = value;
  ensureGestureListeners();
  applyVolume();
  if (muted) {
    stopSequence();
    stopVoices(effectVoices);
  } else startMusic();
}
export function isAudioMuted() {
  return muted;
}

export function playSound(kind: string) {
  ensureGestureListeners();
  if (
    muted ||
    !options.sound ||
    options.volume <= 0 ||
    !unlocked ||
    !context ||
    !effects ||
    context.state !== 'running' ||
    document.hidden
  )
    return;
  try {
    if (['start', 'pull', 'victory'].includes(kind)) crowdCheer(kind === 'victory');
    (tones[kind] || tones.click).forEach((frequency, index) => {
      const oscillator = context!.createOscillator(),
        envelope = context!.createGain();
      const start = context!.currentTime + index * 0.11;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.13, start + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(envelope);
      envelope.connect(effects!);
      trackVoice(oscillator, 'effects', [envelope]);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  } catch {
    /* Gameplay remains usable without an audio device. */
  }
}

ensureGestureListeners();

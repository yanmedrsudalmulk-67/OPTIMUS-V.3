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
const musicVoices = new Set<OscillatorNode>();

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
  for (const oscillator of musicVoices) {
    try {
      oscillator.stop();
    } catch {
      /* An ended voice needs no further cleanup. */
    }
  }
  musicVoices.clear();
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
  musicVoices.add(oscillator);
  oscillator.onended = () => {
    musicVoices.delete(oscillator);
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(at);
  oscillator.stop(at + duration + 0.025);
}

// Original 16-step marimba phrase with a four-chord bass line, synthesized locally.
const melody = [76, 79, 83, 79, 74, -1, 72, 76, 77, 81, 79, -1, 74, 79, 76, -1];
const bassLine = [48, 45, 41, 43];
const frequencyFor = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
function scheduleMusic() {
  if (!context || context.state !== 'running') return;
  const stepSeconds = 60 / 108 / 2;
  if (nextNoteAt < context.currentTime) nextNoteAt = context.currentTime + 0.035;
  while (nextNoteAt < context.currentTime + 0.35) {
    const index = musicStep % melody.length;
    if (melody[index] >= 0) note(frequencyFor(melody[index]), nextNoteAt, 0.22, 0.075);
    if (index % 4 === 0)
      note(frequencyFor(bassLine[Math.floor(index / 4)]), nextNoteAt, 0.8, 0.12, true);
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
  window.addEventListener('pagehide', () => stopSequence());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSequence();
    else startMusic();
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
  if (!musicRequested || options.volume === 0) stopSequence();
  else startMusic();
}

/** Cancel the background scheduler and its voices when leaving a match screen. */
export function stopMusic() {
  musicRequested = false;
  stopSequence();
}

export function setMuted(value: boolean) {
  muted = value;
  ensureGestureListeners();
  applyVolume();
  if (muted) stopSequence();
  else startMusic();
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
    context.state !== 'running'
  )
    return;
  try {
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
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  } catch {
    /* Gameplay remains usable without an audio device. */
  }
}

ensureGestureListeners();

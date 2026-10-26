'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  Copy,
  HeartPulse,
  Maximize,
  Minimize,
  Pause,
  QrCode,
  Settings2,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Quality } from '@shared/index';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';
import { Balance, ResultCard, TeamRoster } from './RoomParts';
import { useRoom } from './useRoom';
import './game.css';

const Arena = dynamic(() => import('../arena/Arena'), {
  ssr: false,
  loading: () => (
    <div className="display-canvas-loading">
      <span className="spinner" />
      <span>Menyiapkan arena 3D…</span>
    </div>
  ),
});
export default function GameDisplay({ code: rawCode }: { code: string }) {
  const code = rawCode.toUpperCase();
  const { state, connected, loading, error, seconds } = useRoom(code);
  const [qr, setQr] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [muted, updateMuted] = useState(isAudioMuted);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uiError, setUiError] = useState('');
  const displayRef = useRef<HTMLDivElement>(null);
  const phase = useRef('');
  useEffect(() => {
    const url = `${window.location.origin}/join/${code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#17382f', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setUiError('QR tidak dapat dibuat. Gunakan kode room untuk bergabung.'));
  }, [code]);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    if (state && phase.current !== state.phase) {
      if (state.phase === 'FINISHED') playSound('victory');
      else if (state.phase === 'COUNTDOWN') playSound('countdown');
      else if (state.phase === 'PULL_ANIMATION') playSound('pull');
      else if (state.phase === 'QUESTION_ACTIVE' && phase.current === 'COUNTDOWN')
        playSound('start');
      phase.current = state.phase;
    }
  }, [state?.phase]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await displayRef.current?.requestFullscreen();
    } catch {
      setUiError('Layar penuh tidak tersedia pada browser ini.');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setUiError('Salin URL bergabung dari bilah alamat atau gunakan QR.');
    }
  };
  if (!state)
    return (
      <div className="game-display">
        <div className="game-loading">
          <span className="spinner" />
          <h2>{loading ? 'Menghubungkan ke arena…' : 'Arena belum tersedia'}</h2>
          <p>{error || 'Sinkronisasi dengan server pertandingan.'}</p>
          <Link href="/" className="btn btn-secondary">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  const lobby = ['WAITING', 'READY'].includes(state.phase);
  return (
    <div className={`game-display ${lobby ? 'display-lobby' : ''}`} ref={displayRef}>
      <header className="display-header">
        <Link href="/" className="display-home" aria-label="Kembali ke beranda">
          <HeartPulse size={24} />
        </Link>
        <div className="display-title">
          <strong>{state.title}</strong>
          <span>{state.packageName}</span>
        </div>
        <div className={`display-connected ${connected ? '' : 'offline'}`}>
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{connected ? 'LIVE' : 'RECONNECTING'}</span>
        </div>
        <div className="display-room">
          ROOM <b>{code}</b>
        </div>
        <button
          aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          onClick={() => {
            setMuted(!muted);
            updateMuted(!muted);
          }}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
        <select
          value={quality ?? state.settings.quality}
          onChange={(e) => setQuality(e.target.value as Quality)}
          aria-label="Kualitas grafis"
        >
          {(['AUTO', 'LOW', 'MEDIUM', 'HIGH'] as Quality[]).map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
        <button
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        >
          {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
      </header>
      {uiError && (
        <div className="display-notice" onClick={() => setUiError('')}>
          {uiError}
        </div>
      )}
      <div className="display-scoreboard">
        <div className="display-team team-a">
          <span className="team-dot" />
          <div>
            <small>TEAM GREEN</small>
            <h1>{state.teamAName}</h1>
          </div>
          <strong>
            {state.teamAPower}
            <small>POWER</small>
          </strong>
        </div>
        <div className="display-round">
          <span>{lobby ? 'HEALTHCARE HEROES' : 'QUIZ BATTLE'}</span>
          <b>
            {lobby ? (
              <Users size={26} />
            ) : state.phase === 'FINISHED' ? (
              'SELESAI'
            ) : state.paused ? (
              <Pause size={27} />
            ) : state.phase === 'QUESTION_ACTIVE' ? (
              `${seconds}s`
            ) : state.phase === 'COUNTDOWN' ? (
              seconds || 'GO!'
            ) : (
              `${Math.min(state.questionIndex + 1, state.questionCount)} / ${state.questionCount}`
            )}
          </b>
          <small>
            {lobby
              ? `${state.players.length}/6 PEMAIN`
              : state.paused
                ? 'DIJEDA'
                : state.phase === 'QUESTION_ACTIVE'
                  ? `SOAL ${Math.min(state.questionIndex + 1, state.questionCount)} / ${state.questionCount}`
                  : state.phase === 'COUNTDOWN'
                    ? 'BATTLE START'
                    : 'RONDE PERTANDINGAN'}
          </small>
        </div>
        <div className="display-team team-b">
          <strong>
            {state.teamBPower}
            <small>POWER</small>
          </strong>
          <div>
            <small>TEAM BLUE</small>
            <h1>{state.teamBName}</h1>
          </div>
          <span className="team-dot" />
        </div>
      </div>
      <section className="display-arena">
        <Arena state={state} theme={state.settings.arena} quality={quality ?? undefined} />
        {state.paused && (
          <div className="arena-paused">
            <Pause size={30} />
            <h2>Pertandingan dijeda</h2>
            <p>Menunggu host melanjutkan.</p>
          </div>
        )}
        {state.phase === 'COUNTDOWN' && (
          <div className="arena-countdown">
            <span>BATTLE START</span>
            <strong>{seconds || 'BATTLE!'}</strong>
          </div>
        )}
        {state.phase === 'PULL_ANIMATION' && (
          <div className="arena-pull-label">
            {state.teamAPower === state.teamBPower
              ? 'POWER BALANCED!'
              : `${state.teamAPower > state.teamBPower ? state.teamAName : state.teamBName} MENARIK!`}
          </div>
        )}
      </section>
      <div className="display-balance">
        <Balance state={state} />
      </div>
      {lobby ? (
        <section className="display-lobby-bottom">
          <TeamRoster state={state} team="A" compact />
          <div className="display-join">
            <div>
              <QrCode size={18} />
              <strong>Pindai. Pilih hero. READY!</strong>
            </div>
            {qr && <img src={qr} alt={`QR bergabung ke room ${code}`} width="118" height="118" />}
            <span>
              atau masukkan kode <b>{code}</b>
            </span>
            <button onClick={() => void copy()}>
              <Copy size={13} />
              {copied ? 'Tautan disalin' : 'Salin tautan bergabung'}
            </button>
          </div>
          <TeamRoster state={state} team="B" compact />
        </section>
      ) : state.phase === 'FINISHED' ? (
        <div className="display-results-overlay">
          <ResultCard state={state} />
        </div>
      ) : state.question ? (
        <section className="display-question">
          <div className="display-question-number">
            <span>SOAL</span>
            <strong>{String(state.questionIndex + 1).padStart(2, '0')}</strong>
          </div>
          <div className="display-question-content">
            <h2>{state.question.text}</h2>
            <div className="display-options">
              {state.question.options.map((option, index) => (
                <div className={state.correctAnswer === index ? 'correct' : ''} key={index}>
                  <b>{String.fromCharCode(65 + index)}</b>
                  <span>{option}</span>
                  {state.correctAnswer === index && <CheckCheck size={18} />}
                </div>
              ))}
            </div>
            {state.correctAnswer !== undefined && state.explanation && (
              <p className="display-explanation">{state.explanation}</p>
            )}
          </div>
          <div className="display-answered">
            <strong>
              {state.players.filter((p) => p.answered).length}
              <small>/6</small>
            </strong>
            <span>
              JAWABAN
              <br />
              TERKIRIM
            </span>
          </div>
        </section>
      ) : (
        <div className="display-waiting">Menyiapkan pertanyaan berikutnya…</div>
      )}
      <footer className="display-footer">
        <span>
          MEDICAL TUG OF WAR <i /> Healthcare Heroes Quiz Battle
        </span>
        <span>
          {lobby
            ? 'Host memulai setelah 6 pemain siap.'
            : 'Jawab melalui smartphone masing-masing.'}
        </span>
      </footer>
    </div>
  );
}

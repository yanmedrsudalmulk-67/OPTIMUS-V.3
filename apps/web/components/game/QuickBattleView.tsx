'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Copy,
  Home,
  Maximize,
  Minimize,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Team } from '../../../../packages/shared/src';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';
import {
  readGamePrefs,
  readQuickSession,
  saveQuickSession,
  type QuickPlayMode,
} from '../../lib/gamePrefs';
import { emit } from '../../lib/socket';
import { Balance, ResultCard } from './RoomParts';
import { useRoom } from './useRoom';
import './game.css';
import './quick-play.css';

const Arena = dynamic(() => import('../arena/Arena'), {
  ssr: false,
  loading: () => (
    <div className="display-canvas-loading">
      <span className="spinner" />
      <span>Menyiapkan arena 3D…</span>
    </div>
  ),
});

const OPTIONS_LETTERS = ['A', 'B', 'C', 'D'] as const;
const TEAM_A_KEYS = ['1', '2', '3', '4'] as const;
const TEAM_B_KEYS = ['7', '8', '9', '0'] as const;

export default function QuickBattleView({ code: rawCode }: { code: string }) {
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const { state, loading, error, seconds } = useRoom(code, false);

  const [quickToken, setQuickToken] = useState('');
  const [mode, setMode] = useState<QuickPlayMode>('local');
  const [muted, updateMuted] = useState(isAudioMuted);
  const [fullscreen, setFullscreen] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyB, setBusyB] = useState(false);
  const [hostBusy, setHostBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const lastPhase = useRef('');
  const botAnsweredQid = useRef('');

  useEffect(() => {
    const saved = readQuickSession(code);
    const prefs = readGamePrefs();
    if (saved) {
      setQuickToken(saved.quickToken);
      setMode(saved.mode);
    } else {
      setMode(prefs.playMode);
    }
    if (!prefs.sound) {
      setMuted(true);
      updateMuted(true);
    } else {
      setMuted(false);
      updateMuted(false);
    }

    const joinLink = `${window.location.origin}/join/${code}`;
    QRCode.toDataURL(joinLink, { margin: 1, width: 220, color: { dark: '#071629', light: '#ffffff' } })
      .then(setQrUrl)
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (lastPhase.current !== state.phase) {
      if (state.phase === 'FINISHED') playSound('victory');
      else if (state.phase === 'COUNTDOWN') playSound('countdown');
      else if (state.phase === 'QUESTION_ACTIVE') playSound('start');
      else if (state.phase === 'PULL_ANIMATION') playSound('pull');
      else if (state.phase === 'ANSWER_REVEAL') playSound('reveal');
      else if (state.phase === 'ROUND_RESULT') playSound('round');
      lastPhase.current = state.phase;
    }
  }, [state]);

  const submitAnswer = useCallback(
    async (team: Team, answerIndex: number) => {
      if (
        !state ||
        !quickToken ||
        state.paused ||
        state.phase !== 'QUESTION_ACTIVE' ||
        !state.question?.id
      ) {
        return;
      }
      if (state.teams[team].answered) return;
      if (team === 'A' && busyA) return;
      if (team === 'B' && busyB) return;

      if (team === 'A') setBusyA(true);
      else setBusyB(true);
      setActionError('');

      try {
        await emit('quick:submit-answer', {
          code,
          quickToken,
          team,
          questionId: state.question.id,
          answer: answerIndex,
        });
        playSound('answer');
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Gagal mengirim jawaban.');
      } finally {
        if (team === 'A') setBusyA(false);
        else setBusyB(false);
      }
    },
    [busyA, busyB, code, quickToken, state],
  );

  // Bot AI opponent automation for Team B
  useEffect(() => {
    if (
      mode !== 'bot' ||
      !quickToken ||
      !state ||
      state.paused ||
      state.phase !== 'QUESTION_ACTIVE' ||
      !state.question?.id ||
      state.teams.B.answered
    ) {
      return;
    }
    const qid = state.question.id;
    if (botAnsweredQid.current === qid) return;

    const delayMs = 2400 + Math.floor(Math.random() * 2300);
    const timer = setTimeout(() => {
      botAnsweredQid.current = qid;
      void emit('quick:bot-answer', {
        code,
        quickToken,
        team: 'B',
        questionId: qid,
      })
        .then(() => playSound('answer'))
        .catch(() => {
          botAnsweredQid.current = '';
        });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [code, mode, quickToken, state]);

  // Fast keyboard buzzer shortcuts: 1-4 (Team A), 7-0 (Team B)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showQr || !state || state.paused || state.phase !== 'QUESTION_ACTIVE') return;
      const idxA = TEAM_A_KEYS.indexOf(e.key as (typeof TEAM_A_KEYS)[number]);
      if (idxA !== -1 && !state.teams.A.answered) {
        e.preventDefault();
        void submitAnswer('A', idxA);
        return;
      }
      if (mode === 'local') {
        const idxB = TEAM_B_KEYS.indexOf(e.key as (typeof TEAM_B_KEYS)[number]);
        if (idxB !== -1 && !state.teams.B.answered) {
          e.preventDefault();
          void submitAnswer('B', idxB);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, showQr, state, submitAnswer]);

  const runHostAction = async (
    action: 'pause-match' | 'resume-match' | 'next-question' | 'end-match' | 'rematch',
  ) => {
    if (!quickToken || hostBusy) return;
    setHostBusy(true);
    setActionError('');
    try {
      await emit('quick:host-action', { code, quickToken, action });
      if (action === 'rematch') botAnsweredQid.current = '';
      playSound('click');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Aksi belum dapat diproses.');
    } finally {
      setHostBusy(false);
    }
  };

  const toggleMode = () => {
    const next: QuickPlayMode = mode === 'local' ? 'bot' : 'local';
    setMode(next);
    if (quickToken) {
      saveQuickSession({
        code,
        quickToken,
        mode: next,
        title: state?.title,
        updatedAt: Date.now(),
      });
    }
    playSound('select');
  };

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    try {
      if (!document.fullscreenElement) await rootRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* Browser may block fullscreen outside direct gesture. */
    }
  };

  if (!state) {
    return (
      <div className="qb-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div
          style={{
            background: '#0d213d',
            border: '2px solid #214571',
            borderRadius: 16,
            padding: 28,
            maxWidth: 420,
            textAlign: 'center',
          }}
        >
          <span className="spinner" />
          <h2 style={{ marginTop: 14 }}>{loading ? 'Memasuki Arena 3D…' : 'Room Tidak Tersedia'}</h2>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            {error || 'Menyiapkan pertandingan tarik tambang.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
            <Link href="/play" className="qp-back-btn">
              <Play size={15} /> PILIH KARAKTER BARU
            </Link>
            <Link href="/" className="qp-pill">
              <Home size={14} /> MENU
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canAnswer = Boolean(quickToken) && state.phase === 'QUESTION_ACTIVE' && !state.paused;
  const showReveal = state.correctAnswer !== undefined;

  return (
    <div className="qb-shell" ref={rootRef}>
      {/* TOP 3D ARENA VIEWPORT */}
      <section className="qb-arena-stage">
        <Arena state={state} theme={state.settings.arena} quality={state.settings.quality} />

        {/* TOP ARCADE SCOREBOARD */}
        <header className="qb-hud-top">
          <div className="qb-team-hud team-a">
            <span className="team-dot" />
            <div>
              <strong>{state.teamAName}</strong>
              <small>
                Skor {state.teams.A.score} · Benar {state.teams.A.correctCount}
              </small>
            </div>
            <span className="qb-power-num">{state.teams.A.power}P</span>
          </div>

          <div className="qb-center-hud">
            <div className="qb-timer-pill">
              <span>
                SOAL {Math.min(state.questionIndex + 1, state.questionCount)}/{state.questionCount}
              </span>
              {state.phase === 'QUESTION_ACTIVE' && <b>{seconds}s</b>}
              {state.phase === 'COUNTDOWN' && <b>{seconds || 'GO!'}</b>}
            </div>
            <div className="qb-balance-top">
              <Balance state={state} />
            </div>
          </div>

          <div className="qb-team-hud team-b">
            <span className="qb-power-num">{state.teams.B.power}P</span>
            <div>
              <strong>{state.teamBName}</strong>
              <small>
                Skor {state.teams.B.score} · Benar {state.teams.B.correctCount}
              </small>
            </div>
            <span className="team-dot dot-blue" />
          </div>
        </header>

        {/* FLOATING QUICK ACTION CHIPS */}
        <div className="qb-hud-actions">
          {quickToken && (
            <>
              <button type="button" className="qb-action-chip" onClick={toggleMode}>
                {mode === 'local' ? <Users size={13} /> : <Bot size={13} />}
                {mode === 'local' ? '2 Tim Lokal' : 'VS Bot AI'}
              </button>
              <button
                type="button"
                className="qb-action-chip"
                disabled={hostBusy || state.phase === 'FINISHED'}
                onClick={() => void runHostAction(state.paused ? 'resume-match' : 'pause-match')}
              >
                {state.paused ? <Play size={13} /> : <Pause size={13} />}
                {state.paused ? 'Lanjut' : 'Jeda'}
              </button>
            </>
          )}
          <button type="button" className="qb-action-chip" onClick={() => setShowQr(true)}>
            <QrCode size={13} /> {code}
          </button>
          <button
            type="button"
            className="qb-action-chip"
            aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              updateMuted(next);
            }}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            type="button"
            className="qb-action-chip"
            aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
          <Link href="/" className="qb-action-chip" aria-label="Menu utama">
            <ArrowLeft size={13} /> Menu
          </Link>
        </div>

        {/* DRAMATIC ARENA CENTER BANNERS */}
        {state.paused && (
          <div className="arena-paused">
            <Pause size={30} />
            <h2>Pertandingan Dijeda</h2>
            <p>Tekan Lanjut untuk meneruskan tarik tambang.</p>
            {quickToken && (
              <button
                type="button"
                className="qp-start-cta"
                style={{ height: 48, fontSize: 15 }}
                onClick={() => void runHostAction('resume-match')}
              >
                <Play size={16} fill="currentColor" /> LANJUTKAN
              </button>
            )}
          </div>
        )}

        {state.phase === 'COUNTDOWN' && (
          <div className="arena-countdown">
            <span>BATTLE START!</span>
            <strong>{seconds || 'TARIK!'}</strong>
          </div>
        )}

        {state.phase === 'PULL_ANIMATION' && (
          <div className="arena-pull-label">
            {state.teamAPower === state.teamBPower
              ? 'SEIMBANG! POWER BALANCED!'
              : `${state.teamAPower > state.teamBPower ? state.teamAName : state.teamBName} MENARIK TALI!`}
          </div>
        )}
      </section>

      {/* BOTTOM SPLIT QUIZ & DUAL-TEAM BUZZER CONSOLE */}
      {state.phase !== 'FINISHED' && (
        <section className="qb-quiz-console" aria-label="Panel soal dan tombol jawaban kedua tim">
          {/* LEFT DECK: TIM HIJAU */}
          <div className="qb-deck team-a">
            <div className="qb-deck-head">
              <span>{state.teamAName}</span>
              <small>Key 1–4</small>
            </div>
            {state.teams.A.answered ? (
              <div className="qb-deck-locked">
                <CheckCheck size={22} color="#34d399" />
                <span>
                  {showReveal
                    ? state.teams.A.lastCorrect
                      ? 'BENAR! +10 POWER'
                      : 'KURANG TEPAT'
                    : 'JAWABAN TERKUNCI ✓'}
                </span>
              </div>
            ) : (
              <div className="qb-deck-btns">
                {OPTIONS_LETTERS.map((letter, idx) => (
                  <button
                    key={`A-${letter}`}
                    type="button"
                    className="qb-buzzer-btn"
                    disabled={!canAnswer || busyA}
                    aria-label={`${state.teamAName} jawab ${letter}`}
                    onClick={() => void submitAnswer('A', idx)}
                  >
                    {letter} <small>[{TEAM_A_KEYS[idx]}]</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CENTER QUESTION & READABLE OPTIONS */}
          <div className="qb-question-center">
            {actionError && (
              <div className="qp-error-banner" role="alert">
                {actionError}
              </div>
            )}
            {state.question ? (
              <>
                <div className="qb-question-header">
                  <span>SOAL 0{state.questionIndex + 1}</span>
                  <h2>{state.question.text}</h2>
                </div>
                <div className="qb-options-readout">
                  {state.question.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`qb-opt-pill ${state.correctAnswer === idx ? 'is-correct' : ''}`}
                    >
                      <b>{OPTIONS_LETTERS[idx]}</b>
                      <span>{opt}</span>
                      {state.correctAnswer === idx && <CheckCheck size={16} />}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#94a3b8' }}>
                Bersiap untuk pertanyaan…
              </div>
            )}
          </div>

          {/* RIGHT DECK: TIM BIRU */}
          <div className="qb-deck team-b">
            <div className="qb-deck-head">
              <span>{state.teamBName}</span>
              <small>{mode === 'bot' ? 'AI Bot' : 'Key 7–0'}</small>
            </div>
            {state.teams.B.answered ? (
              <div className="qb-deck-locked">
                <CheckCheck size={22} color="#38bdf8" />
                <span>
                  {showReveal
                    ? state.teams.B.lastCorrect
                      ? 'BENAR! +10 POWER'
                      : 'KURANG TEPAT'
                    : 'JAWABAN TERKUNCI ✓'}
                </span>
              </div>
            ) : mode === 'bot' ? (
              <div className="qb-deck-locked">
                <Bot size={24} color="#facc15" />
                <span>AI Hero sedang berpikir…</span>
              </div>
            ) : (
              <div className="qb-deck-btns">
                {OPTIONS_LETTERS.map((letter, idx) => (
                  <button
                    key={`B-${letter}`}
                    type="button"
                    className="qb-buzzer-btn"
                    disabled={!canAnswer || busyB}
                    aria-label={`${state.teamBName} jawab ${letter}`}
                    onClick={() => void submitAnswer('B', idx)}
                  >
                    {letter} <small>[{TEAM_B_KEYS[idx]}]</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* VICTORY OVERLAY */}
      {state.phase === 'FINISHED' && (
        <div className="qb-victory-overlay">
          <div style={{ maxWidth: 680, width: '100%' }}>
            <ResultCard state={state} />
            <div className="qb-victory-actions">
              {quickToken && (
                <button
                  type="button"
                  className="qp-start-cta"
                  style={{ height: 50, fontSize: 15 }}
                  disabled={hostBusy}
                  onClick={() => void runHostAction('rematch')}
                >
                  <RotateCcw size={17} /> MAIN LAGI (TIM SAMA)
                </button>
              )}
              <button
                type="button"
                className="qp-back-btn"
                style={{ height: 50 }}
                onClick={() => router.push('/play')}
              >
                <Users size={16} /> PILIH KARAKTER BARU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTIONAL MULTI-DEVICE QR MODAL */}
      {showQr && (
        <div className="display-modal-backdrop" onClick={() => setShowQr(false)}>
          <div className="display-qr-modal card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setShowQr(false)}
              aria-label="Tutup QR"
            >
              <X size={18} />
            </button>
            <h3>Kode Room: {code}</h3>
            <p>Bisa dijawab langsung di layar ini atau lewat HP di /join/{code}</p>
            {qrUrl && <img src={qrUrl} alt={`QR Room ${code}`} width={200} height={200} />}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              <Copy size={13} />
              {copied ? 'Tautan disalin' : 'Salin tautan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

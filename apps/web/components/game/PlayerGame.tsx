'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Edit2,
  HeartPulse,
  LoaderCircle,
  LogOut,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHARACTERS, type Team, type TeamCharacterSlot } from '@shared/index';
import { emit } from '../../lib/socket';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';
import { Balance, GameHeader, ResultCard } from './RoomParts';
import { readSession, saveSession, sessionKey, useRoom } from './useRoom';
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

export default function PlayerGame({
  code: rawCode,
  mode,
}: {
  code: string;
  mode: 'lobby' | 'play';
}) {
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const { state, session, connected, loading, error, setError, seconds } = useRoom(code, true);

  const [busy, setBusy] = useState(false);
  const [muted, updateMuted] = useState(isAudioMuted);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Edit Team Modal / Inline State
  const [editingTeam, setEditingTeam] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editCharacters, setEditCharacters] = useState<TeamCharacterSlot[]>([]);

  const previousPhase = useRef('');
  const myTeamSide: Team = session?.team || 'A';
  const myTeam = state?.teams?.[myTeamSide];
  const oppTeamSide: Team = myTeamSide === 'A' ? 'B' : 'A';
  const oppTeam = state?.teams?.[oppTeamSide];

  const questionId = state?.question?.id;

  useEffect(() => {
    const saved = readSession(code);
    if (!saved) router.replace(`/join/${code}`);
  }, [code, router]);

  // Handle phase routing between lobby and play
  useEffect(() => {
    if (!state) return;
    const isLobbyPhase = ['WAITING', 'READY'].includes(state.phase);
    if (isLobbyPhase && mode === 'play') router.replace(`/lobby/${code}`);
    if (!isLobbyPhase && mode === 'lobby') router.replace(`/play/${code}`);

    if (state.phase !== previousPhase.current) {
      playSound(
        state.phase === 'FINISHED'
          ? 'victory'
          : state.phase === 'QUESTION_ACTIVE'
            ? 'start'
            : state.phase === 'COUNTDOWN'
              ? 'countdown'
              : state.phase === 'PULL_ANIMATION'
                ? 'pull'
                : 'click',
      );
      previousPhase.current = state.phase;
    }
  }, [state?.phase, mode, code, router]);

  // Reset selected answer on new question
  useEffect(() => {
    if (state?.phase === 'QUESTION_ACTIVE') {
      setSelectedAnswer(null);
    }
  }, [state?.question?.id, state?.phase]);

  const toggleReady = async () => {
    if (!myTeam || busy) return;
    setBusy(true);
    setError('');
    try {
      const nextReady = !myTeam.ready;
      await emit('team:ready', { code, ready: nextReady });
      playSound('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperbarui status siap.');
    } finally {
      setBusy(false);
    }
  };

  const submitTeamAnswer = async (index: number) => {
    if (!questionId || selectedAnswer !== null || myTeam?.answered || busy) return;
    setBusy(true);
    setError('');
    try {
      setSelectedAnswer(index);
      await emit('team:submit-answer', { code, questionId, answer: index });
      playSound('answer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jawaban tim belum terkirim.');
      setSelectedAnswer(null);
    } finally {
      setBusy(false);
    }
  };

  const openEditModal = () => {
    if (!myTeam) return;
    setEditTeamName(myTeam.name);
    setEditCharacters([...myTeam.characters]);
    setEditingTeam(true);
  };

  const saveTeamEdits = async () => {
    if (!myTeam || busy) return;
    setBusy(true);
    setError('');
    try {
      await emit('team:update', {
        code,
        teamName: editTeamName.trim(),
        characters: editCharacters,
        ready: false,
      });
      setEditingTeam(false);
      playSound('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan perubahan tim.');
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="player-page">
        <GameHeader connected={connected} code={code} />
        <div className="game-loading card">
          <span className="spinner" />
          <h2>Menghubungkan ke Tim…</h2>
          <p>{error || 'Memulihkan sesi pengendali tim.'}</p>
        </div>
      </div>
    );
  }

  const isLobby = ['WAITING', 'READY'].includes(state.phase);
  const bothTeamsReady =
    state.teams.A.connected &&
    state.teams.A.ready &&
    state.teams.B.connected &&
    state.teams.B.ready;

  // -------------------------------------------------------------
  // LOBBY ROOM VIEW (TWO TEAM PANELS + BIG VS + START BUTTON)
  // -------------------------------------------------------------
  if (isLobby) {
    return (
      <div className="player-page lobby-page">
        <GameHeader connected={connected} code={code} />

        <main className="two-teams-lobby">
          <div className="lobby-header-banner">
            <span className="eyebrow">TWO TEAM CONTROLLERS · LOBBY</span>
            <h1>{state.title}</h1>
            <p className="muted">{state.packageName} · 6 Hero 3D Siap Bertanding</p>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}

          {/* TWO TEAM PANELS WITH VS IN THE MIDDLE */}
          <div className="teams-versus-container">
            {/* TEAM A PANEL */}
            <div className={`team-lobby-card team-a-lobby ${myTeamSide === 'A' ? 'is-my-team' : ''}`}>
              <div className="team-lobby-header">
                <span className="team-badge-tag tag-a">TEAM GREEN</span>
                <h2>{state.teams.A.name}</h2>
                <div className="controller-status">
                  <span className={`status-dot ${state.teams.A.connected ? 'dot-green' : 'dot-off'}`} />
                  <span>{state.teams.A.connected ? 'CONTROLLER CONNECTED' : 'MENUNGGU PENGENDALI'}</span>
                </div>
              </div>

              {/* 3 HEROES LIST */}
              <div className="lobby-heroes-list">
                {state.teams.A.characters.map((ch, idx) => {
                  const def = CHARACTERS.find((c) => c.id === ch.characterId) || CHARACTERS[0];
                  return (
                    <div key={idx} className="lobby-hero-item">
                      <div className="lobby-hero-avatar" style={{ background: def.color }}>
                        <span>{def.name[0]}</span>
                      </div>
                      <div className="lobby-hero-info">
                        <strong>{ch.name}</strong>
                        <small>{def.profession}</small>
                      </div>
                      <span className="hero-slot-label">Slot 0{idx + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Team A Ready Badge */}
              <div className="team-lobby-footer">
                <span className={`ready-pill ${state.teams.A.ready ? 'pill-ready' : 'pill-wait'}`}>
                  {state.teams.A.ready ? <CheckCheck size={16} /> : <LoaderCircle size={16} />}
                  <span>{state.teams.A.ready ? 'READY TO BATTLE' : 'NOT READY'}</span>
                </span>
                {myTeamSide === 'A' && (
                  <button className="btn btn-secondary btn-small" onClick={openEditModal}>
                    <Edit2 size={13} /> Edit Tim
                  </button>
                )}
              </div>
            </div>

            {/* BIG VS BADGE */}
            <div className="versus-badge-divider">
              <div className="vs-circle">
                <Swords size={28} />
                <span>VS</span>
              </div>
            </div>

            {/* TEAM B PANEL */}
            <div className={`team-lobby-card team-b-lobby ${myTeamSide === 'B' ? 'is-my-team' : ''}`}>
              <div className="team-lobby-header">
                <span className="team-badge-tag tag-b">TEAM BLUE</span>
                <h2>{state.teams.B.name}</h2>
                <div className="controller-status">
                  <span className={`status-dot ${state.teams.B.connected ? 'dot-blue' : 'dot-off'}`} />
                  <span>{state.teams.B.connected ? 'CONTROLLER CONNECTED' : 'MENUNGGU PENGENDALI'}</span>
                </div>
              </div>

              {/* 3 HEROES LIST */}
              <div className="lobby-heroes-list">
                {state.teams.B.characters.map((ch, idx) => {
                  const def = CHARACTERS.find((c) => c.id === ch.characterId) || CHARACTERS[0];
                  return (
                    <div key={idx} className="lobby-hero-item">
                      <div className="lobby-hero-avatar" style={{ background: def.color }}>
                        <span>{def.name[0]}</span>
                      </div>
                      <div className="lobby-hero-info">
                        <strong>{ch.name}</strong>
                        <small>{def.profession}</small>
                      </div>
                      <span className="hero-slot-label">Slot 0{idx + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Team B Ready Badge */}
              <div className="team-lobby-footer">
                <span className={`ready-pill ${state.teams.B.ready ? 'pill-ready' : 'pill-wait'}`}>
                  {state.teams.B.ready ? <CheckCheck size={16} /> : <LoaderCircle size={16} />}
                  <span>{state.teams.B.ready ? 'READY TO BATTLE' : 'NOT READY'}</span>
                </span>
                {myTeamSide === 'B' && (
                  <button className="btn btn-secondary btn-small" onClick={openEditModal}>
                    <Edit2 size={13} /> Edit Tim
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* LOBBY CONTROLLER ACTIONS */}
          <div className="lobby-controller-bar card">
            <div className="controller-meta">
              <strong>Tim Anda: {myTeam?.name || `Tim ${myTeamSide}`}</strong>
              <small>Status: {myTeam?.ready ? 'Sudah Siap' : 'Menunggu Konfirmasi Siap'}</small>
            </div>

            <div className="controller-button-group">
              <button
                className={`btn ${myTeam?.ready ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => void toggleReady()}
                disabled={busy}
              >
                {myTeam?.ready ? 'Batalkan Siap' : 'SAYA SIAP (READY)'}
              </button>
            </div>
          </div>

          {bothTeamsReady ? (
            <div className="admin-waiting-banner">
              <div className="admin-waiting-pulse" />
              <div>
                <strong>Kedua Tim Sudah Siap!</strong>
                <p>Menunggu Administrator memulai pertandingan dari Ruang Kontrol...</p>
              </div>
            </div>
          ) : (
            <p className="lobby-hint">
              Pastikan kedua tim telah memilih pahlawan dan menekan tombol <b>SAYA SIAP (READY)</b>. Pertandingan dimulai oleh Admin.
            </p>
          )}
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAY VIEW — FULL WIDTH ARENA FIRST, UI SECOND
  // -------------------------------------------------------------
  return (
    <div className="player-page cinematic-play-page">
      {/* TOP HUD: Minimal & Clean */}
      <header className="play-top-hud">
        <div className="hud-team hud-team-a">
          <span className="team-dot" />
          <div className="hud-team-text">
            <strong>{state.teamAName}</strong>
            <small>{state.teams.A.power} POWER</small>
          </div>
        </div>

        <div className="hud-center">
          <div className="hud-progress-pill">
            <span className="hud-label">
              {state.phase === 'QUESTION_ACTIVE'
                ? `SOAL ${state.questionIndex + 1}/${state.questionCount}`
                : state.phase === 'COUNTDOWN'
                  ? 'PERSIAPAN'
                  : state.phase === 'FINISHED'
                    ? 'SELESAI'
                    : 'HASIL RONDE'}
            </span>
            {state.phase === 'QUESTION_ACTIVE' && (
              <span className="hud-timer">
                <Clock3 size={14} />
                <b>{seconds}s</b>
              </span>
            )}
          </div>
          <div className="hud-balance-bar">
            <Balance state={state} />
          </div>
        </div>

        <div className="hud-team hud-team-b">
          <div className="hud-team-text align-right">
            <strong>{state.teamBName}</strong>
            <small>{state.teams.B.power} POWER</small>
          </div>
          <span className="team-dot dot-blue" />
        </div>
      </header>

      {/* MAIN VIEWPORT: CINEMATIC 3D ARENA (ARENA FIRST!) */}
      <section className="cinematic-arena-container">
        <Arena state={state} theme={state.settings.arena} />

        {/* Phase Overlays inside Arena */}
        {state.phase === 'COUNTDOWN' && (
          <div className="arena-countdown-overlay">
            <span>BATTLE START</span>
            <strong>{seconds || 'GO!'}</strong>
          </div>
        )}

        {state.phase === 'PULL_ANIMATION' && (
          <div className="arena-pull-banner">
            {state.teamAPower === state.teamBPower ? (
              <div className="pull-balanced">POWER BALANCED!</div>
            ) : (
              <div className="pull-winner">
                {state.teamAPower > state.teamBPower ? state.teamAName : state.teamBName} MENARIK TALI!
              </div>
            )}
          </div>
        )}
      </section>

      {/* DEDICATED QUESTION / ANSWER PANEL (SEPARATE CONTAINER, NO OVERLAP) */}
      <section className="dedicated-question-section">
        {state.phase === 'FINISHED' ? (
          <div className="play-result-container">
            <ResultCard state={state} />
          </div>
        ) : state.question ? (
          <div className="active-question-card card">
            <div className="question-header-row">
              <div className="q-badge">
                <span>SOAL 0{state.questionIndex + 1}</span>
                <small>{state.question.points} Poin</small>
              </div>

              <div className="team-answer-status">
                {myTeam?.answered ? (
                  <span className="badge badge-green">
                    <CheckCheck size={14} /> Jawaban Tim Anda Terkirim
                  </span>
                ) : (
                  <span className="badge badge-amber">
                    <Clock3 size={14} /> Pilih 1 Jawaban untuk Tim Anda
                  </span>
                )}
              </div>
            </div>

            <h2 className="question-text">{state.question.text}</h2>

            {/* 4 LARGE TOUCH ANSWER BUTTONS */}
            <div className="play-options-grid">
              {state.question.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx || (state.phase !== 'QUESTION_ACTIVE' && myTeam?.lastAnswer === idx);
                const isCorrect = state.correctAnswer === idx;
                const showReveal = state.correctAnswer !== undefined;

                let btnClass = 'option-btn';
                if (isSelected) btnClass += ' selected';
                if (showReveal && isCorrect) btnClass += ' correct-reveal';
                if (showReveal && isSelected && !isCorrect) btnClass += ' wrong-reveal';

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={myTeam?.answered || state.phase !== 'QUESTION_ACTIVE' || busy}
                    className={btnClass}
                    onClick={() => void submitTeamAnswer(idx)}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="option-body">{opt}</span>
                    {showReveal && isCorrect && <CheckCheck size={18} className="reveal-icon" />}
                  </button>
                );
              })}
            </div>

            {/* EXPLANATION ON REVEAL */}
            {state.correctAnswer !== undefined && state.explanation && (
              <div className="question-explanation-box">
                <strong>Penjelasan:</strong> {state.explanation}
              </div>
            )}
          </div>
        ) : (
          <div className="waiting-next-question card">
            <span className="spinner" />
            <span>Menyiapkan ronde berikutnya…</span>
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckCheck, Clock3, Edit2 } from 'lucide-react';
import type { Team } from '@shared/index';
import { emit } from '../../lib/socket';
import { playSound } from '../../lib/audio';
import { Balance, GameHeader, ResultCard } from './RoomParts';
import { readSession, useRoom } from './useRoom';
import TeamCharacterPicker, { TeamSelectionDialog, type TeamUpdate } from './TeamCharacterPicker';
import './game.css';
import './player-responsive.css';

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
  const { state, session, connected, error, setError, seconds } = useRoom(code, true);

  const [busy, setBusy] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Edit Team Modal / Inline State
  const [editingTeam, setEditingTeam] = useState(false);

  const previousPhase = useRef('');
  const myTeamSide: Team = session?.team || 'A';
  const myTeam = state?.teams?.[myTeamSide];

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
    if (
      !questionId ||
      !myTeam ||
      !connected ||
      state?.paused ||
      selectedAnswer !== null ||
      myTeam.answered ||
      busy
    )
      return;
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

  const updateTeam = async (patch: TeamUpdate) => {
    if (!myTeam || !connected) throw new Error('Koneksi pengendali belum siap.');
    setError('');
    try {
      await emit('team:update', { code, ...patch });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Perubahan belum tersimpan.';
      setError(message);
      throw e;
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
  if (isLobby) {
    return (
      <TeamCharacterPicker
        roomCode={code}
        roomTitle={state.title}
        packageName={state.packageName}
        initialTeam={myTeamSide}
        initialTeamName={myTeam?.name}
        initialCharacters={myTeam?.characters}
        teams={state.teams}
        busy={busy}
        connected={connected && Boolean(session)}
        error={error}
        isEditMode
        ready={Boolean(myTeam?.ready)}
        onUpdate={updateTeam}
        onReady={toggleReady}
        onConfirm={async () => {}}
      />
    );
  }

  // -------------------------------------------------------------
  // PLAY VIEW — FULL WIDTH ARENA FIRST, UI SECOND
  // -------------------------------------------------------------
  return (
    <div className="player-page cinematic-play-page">
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {editingTeam && myTeam && (
        <TeamSelectionDialog label="Edit identitas tim" onClose={() => setEditingTeam(false)}>
          <TeamCharacterPicker
            roomCode={code}
            roomTitle={state.title}
            packageName={state.packageName}
            initialTeam={myTeamSide}
            initialTeamName={myTeam.name}
            initialCharacters={myTeam.characters}
            teams={state.teams}
            connected={connected}
            error={error}
            isEditMode
            lockCharacters
            onUpdate={updateTeam}
            onConfirm={async () => {}}
            onCancel={() => setEditingTeam(false)}
          />
        </TeamSelectionDialog>
      )}
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
      <div className="ts-play-toolbar">
        <span>
          {state.paused
            ? 'Pertandingan dijeda oleh admin'
            : connected
              ? 'Pengendali terhubung'
              : 'Menghubungkan kembali…'}
        </span>
        {myTeam && session && (
          <button
            className="ts-game-settings-trigger"
            type="button"
            onClick={() => setEditingTeam(true)}
          >
            <Edit2 size={15} /> Edit nama tim & hero
          </button>
        )}
      </div>

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
                {state.teamAPower > state.teamBPower ? state.teamAName : state.teamBName} MENARIK
                TALI!
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
                const isSelected =
                  selectedAnswer === idx ||
                  (state.phase !== 'QUESTION_ACTIVE' && myTeam?.lastAnswer === idx);
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
                    disabled={
                      !myTeam ||
                      !connected ||
                      state.paused ||
                      myTeam.answered ||
                      state.phase !== 'QUESTION_ACTIVE' ||
                      busy
                    }
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

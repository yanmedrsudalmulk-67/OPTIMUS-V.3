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
  HeartPulse,
  LoaderCircle,
  LogOut,
  Pause,
  Radio,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHARACTERS } from '@shared/index';
import { emit } from '../../lib/socket';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';
import { Balance, GameHeader, ResultCard, TeamRoster } from './RoomParts';
import { readSession, saveSession, sessionKey, useRoom } from './useRoom';
import './game.css';

const CharacterPreview = dynamic(() => import('../arena/CharacterPreview'), { ssr: false });
export default function PlayerGame({
  code: rawCode,
  mode,
}: {
  code: string;
  mode: 'lobby' | 'play';
}) {
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const { state, player, session, connected, loading, error, setError, seconds } = useRoom(
    code,
    true,
  );
  const [busy, setBusy] = useState(false);
  const [muted, updateMuted] = useState(isAudioMuted);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCharacter, setEditCharacter] = useState('doctor-m');
  const previousPhase = useRef('');
  const questionId = state?.question?.id;
  const selected = questionId ? selections[questionId] : undefined;
  useEffect(() => {
    const saved = readSession(code);
    if (!saved) router.replace(`/join/${code}`);
  }, [code, router]);
  useEffect(() => {
    if (!state) return;
    const lobby = ['WAITING', 'READY'].includes(state.phase);
    if (lobby && mode === 'play') router.replace(`/lobby/${code}`);
    if (!lobby && mode === 'lobby') router.replace(`/play/${code}`);
    if (state.phase !== previousPhase.current) {
      playSound(
        state.phase === 'FINISHED'
          ? 'victory'
          : state.phase === 'QUESTION_ACTIVE'
            ? 'start'
            : state.phase === 'COUNTDOWN'
              ? 'countdown'
              : 'click',
      );
      previousPhase.current = state.phase;
    }
  }, [state?.phase, mode, code, router]);
  const action = async (event: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    setError('');
    try {
      await emit(event, { code, ...payload });
      playSound('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aksi gagal. Silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  };
  const answer = async (index: number) => {
    if (!questionId || selected !== undefined || player?.answered || busy) return;
    setBusy(true);
    setError('');
    try {
      await emit('player:submit-answer', { code, questionId, answer: index });
      setSelections((s) => ({ ...s, [questionId]: index }));
      playSound('answer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jawaban belum terkirim.');
    } finally {
      setBusy(false);
    }
  };
  const updateProfile = async () => {
    setBusy(true);
    setError('');
    try {
      await emit('player:select-character', {
        code,
        characterId: editCharacter,
        name: editName.trim(),
      });
      if (session)
        saveSession(code, { ...session, name: editName.trim(), characterId: editCharacter });
      setEditing(false);
      playSound('select');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan belum tersimpan.');
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    if (!window.confirm('Keluar dari pertandingan? Slotmu akan dikosongkan.')) return;
    try {
      await emit('room:leave', { code });
      localStorage.removeItem(sessionKey(code));
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat keluar.');
    }
  };
  const toggleSound = () => {
    setMuted(!muted);
    updateMuted(!muted);
  };
  if (loading && !state)
    return (
      <div className="player-page">
        <GameHeader connected={connected} code={code} />
        <div className="game-loading">
          <span className="spinner" />
          <h2>Menghubungkan ke arena…</h2>
          <p>Memulihkan sesi pemainmu dengan aman.</p>
        </div>
      </div>
    );
  if (!state)
    return (
      <div className="player-page">
        <GameHeader connected={connected} code={code} />
        <div className="empty-state card">
          <h1>Room belum dapat dibuka</h1>
          <p>{error || 'Periksa kembali kode room dari host.'}</p>
          <Link href="/join" className="btn btn-primary">
            Masukkan kode room
          </Link>
        </div>
      </div>
    );
  const character = CHARACTERS.find((c) => c.id === player?.characterId);
  const isLobby = ['WAITING', 'READY'].includes(state.phase);
  const allReady = state.players.filter((p) => p.connected && p.ready).length;
  const reveal = state.correctAnswer !== undefined && state.phase !== 'QUESTION_ACTIVE';
  return (
    <div className={`player-page ${!isLobby ? 'in-match' : ''}`}>
      <GameHeader connected={connected} code={code} />
      <main className={`player-main ${isLobby ? 'lobby-main' : ''}`}>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {!connected && (
          <div className="reconnecting-banner">
            <LoaderCircle size={16} className="spin" />
            Koneksi terputus. Menghubungkan kembali tanpa membuat pemain baru…
          </div>
        )}
        {session && !player && !loading && (
          <div className="error-message">
            Sesi belum terhubung atau slot telah dikosongkan oleh host.{' '}
            <Link href={`/join/${code}`} onClick={() => localStorage.removeItem(sessionKey(code))}>
              Kembali ke halaman bergabung
            </Link>
          </div>
        )}
        {state.phase === 'FINISHED' ? (
          <ResultCard state={state} player={player} />
        ) : isLobby ? (
          <>
            <div className="lobby-title">
              <span className="badge badge-green">
                <Radio size={13} /> LOBBY PERTANDINGAN
              </span>
              <h1>
                Tim hebat dimulai
                <br />
                dari <em>hero yang siap.</em>
              </h1>
              <p>
                {state.title} <span>·</span> {state.packageName}
              </p>
            </div>
            <div className="lobby-grid">
              <section className="my-player-card card">
                <div className="mini-character">
                  <CharacterPreview
                    characterId={player?.characterId || session?.characterId || 'doctor-m'}
                    team={player?.team || session?.team}
                  />
                </div>
                <div className="my-player-info">
                  <span className="eyebrow">HERO KAMU</span>
                  <h2>{player?.name || session?.name}</h2>
                  <p>
                    {character?.profession} <span>·</span>{' '}
                    {player?.team === 'A' ? state.teamAName : state.teamBName}
                  </p>
                </div>
                <button
                  className={`btn ${player?.ready ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={busy || !connected || !player}
                  onClick={() => void action('player:set-ready', { ready: !player?.ready })}
                >
                  {player?.ready ? (
                    <>
                      <CheckCheck size={19} /> READY · Saya siap
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={19} /> Siap bertanding
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setEditName(player?.name || '');
                    setEditCharacter(player?.characterId || 'doctor-m');
                    setEditing(true);
                  }}
                >
                  Edit nama & karakter
                </button>
                <p className="muted lobby-wait">
                  <Clock3 size={15} /> Menunggu host memulai pertandingan
                </p>
              </section>
              <div className="lobby-teams">
                <TeamRoster state={state} team="A" />
                <div className="lobby-versus">VS</div>
                <TeamRoster state={state} team="B" />
                <div className="lobby-ready-count">
                  <span>
                    <CheckCheck size={18} />
                    <b>{allReady}/6</b> hero siap bertanding
                  </span>
                  <div>
                    <i style={{ width: `${(allReady / 6) * 100}%` }} />
                  </div>
                  <p>Game dimulai oleh host setelah enam pemain terhubung dan siap.</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="player-match-header">
              <div>
                <span className={`badge badge-${player?.team === 'B' ? 'blue' : 'green'}`}>
                  {player?.team === 'B' ? state.teamBName : state.teamAName}
                </span>
                <h2>{player?.name || session?.name}</h2>
              </div>
              <button
                className="sound-button"
                onClick={toggleSound}
                aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
            {state.paused && (
              <div className="pause-panel">
                <Pause size={24} />
                <strong>Pertandingan dijeda</strong>
                <p>Tarik napas dulu. Host akan melanjutkan pertandingan.</p>
              </div>
            )}
            {state.phase === 'COUNTDOWN' ? (
              <section className="countdown-panel card">
                <p className="eyebrow">SEMUA HERO SUDAH SIAP</p>
                <h1>{seconds || 'BATTLE!'}</h1>
                <h2>Siapkan pengetahuanmu!</h2>
                <p>Jawaban benar menjadi kekuatan untuk timmu.</p>
              </section>
            ) : (
              <>
                <section className="quiz-card card">
                  <div className="quiz-meta">
                    <span>
                      PERTANYAAN {Math.min(state.questionIndex + 1, state.questionCount)}{' '}
                      <span className="muted">/ {state.questionCount}</span>
                    </span>
                    <div
                      className={`quiz-timer ${seconds <= 5 && state.phase === 'QUESTION_ACTIVE' ? 'urgent' : ''}`}
                    >
                      <Clock3 size={18} />
                      {state.phase === 'QUESTION_ACTIVE'
                        ? `${seconds}s`
                        : reveal
                          ? 'HASIL'
                          : 'RONDE'}
                    </div>
                  </div>
                  <div className="quiz-progress">
                    <i
                      style={{
                        width: `${state.phase === 'QUESTION_ACTIVE' ? (seconds / (state.question?.duration || state.settings.duration || 20)) * 100 : 100}%`,
                      }}
                    />
                  </div>
                  {state.question?.imageUrl && (
                    <img
                      className="quiz-image"
                      src={state.question.imageUrl}
                      alt="Ilustrasi pertanyaan"
                    />
                  )}
                  <h1>{state.question?.text || 'Menyiapkan pertanyaan berikutnya…'}</h1>
                  <div className="answer-options">
                    {state.question?.options.map((option, index) => {
                      const correct = reveal && index === state.correctAnswer;
                      const wrong = reveal && index === selected && !correct;
                      return (
                        <button
                          key={`${questionId}-${index}`}
                          className={`answer-option ${selected === index ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                          disabled={
                            state.phase !== 'QUESTION_ACTIVE' ||
                            state.paused ||
                            player?.answered ||
                            selected !== undefined ||
                            busy ||
                            !connected ||
                            !player ||
                            seconds === 0
                          }
                          onClick={() => void answer(index)}
                        >
                          <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                          <strong>{option}</strong>
                          {correct ? (
                            <Check size={20} />
                          ) : selected === index ? (
                            <CheckCheck size={20} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {state.phase === 'QUESTION_ACTIVE' &&
                  (selected !== undefined || player?.answered) ? (
                    <div className="answer-confirmation">
                      <CheckCheck size={21} />
                      <div>
                        <strong>ANSWER SUBMITTED</strong>
                        <p>Jawabanmu terkunci. Tunggu hasil dari server.</p>
                      </div>
                    </div>
                  ) : state.phase === 'QUESTION_ACTIVE' ? (
                    <p className="answer-hint">
                      Pilih satu jawaban terbaik. Jawaban yang dikirim tidak dapat diubah.
                    </p>
                  ) : reveal ? (
                    <div className="answer-explanation">
                      <strong>
                        <Check size={17} /> Jawaban benar:{' '}
                        {String.fromCharCode(65 + (state.correctAnswer || 0))}
                      </strong>
                      <p>{state.explanation || 'Bersiap untuk tarikan berikutnya!'}</p>
                    </div>
                  ) : (
                    <p className="answer-hint">
                      {state.phase === 'PULL_ANIMATION'
                        ? 'Tim sedang menarik tali!'
                        : state.phase === 'ROUND_RESULT'
                          ? 'Satu tarikan lebih dekat ke kemenangan.'
                          : 'Pertanyaan berikutnya segera dimulai.'}
                    </p>
                  )}
                </section>
                <section className="player-power card">
                  <Balance state={state} />
                  <div className="player-personal">
                    <span>Kontribusimu</span>
                    <strong>
                      {player?.correctCount || 0} benar <i /> {player?.power || 0} power <i />{' '}
                      {player?.score || 0} poin
                    </strong>
                  </div>
                </section>
              </>
            )}
          </>
        )}
        <div className="player-bottom-actions">
          <Link href={`/display/${code}`} target="_blank">
            Lihat arena <ArrowRight size={14} />
          </Link>
          {isLobby && (
            <button onClick={toggleSound}>
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{' '}
              {muted ? 'Aktifkan suara' : 'Matikan suara'}
            </button>
          )}
          {isLobby && (
            <button onClick={() => void leave()}>
              <LogOut size={15} /> Keluar dari room
            </button>
          )}
        </div>
      </main>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <section className="modal player-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit hero kamu</h2>
            <label className="field">
              Nama pemain
              <input
                className="input"
                maxLength={30}
                minLength={2}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className="field">
              Karakter
              <select
                className="select"
                value={editCharacter}
                onChange={(e) => setEditCharacter(e.target.value)}
              >
                {CHARACTERS.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} — {c.profession}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || editName.trim().length < 2}
                onClick={() => void updateProfile()}
              >
                Simpan perubahan
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

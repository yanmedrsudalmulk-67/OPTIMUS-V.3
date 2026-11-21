'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { type JoinResult, type Team, type TeamCharacterSlot } from '@shared/index';
import { emit } from '../../lib/socket';
import { playSound } from '../../lib/audio';
import { GameHeader } from './RoomParts';
import { readSession, saveSession, useRoom } from './useRoom';
import TeamCharacterPicker from './TeamCharacterPicker';
import './game.css';

export default function JoinGame({ code: initialCode = '' }: { code?: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const code = initialCode.toUpperCase();
  const { state, connected, loading, error, setError } = useRoom(code);

  const [team, setTeam] = useState<Team>('A');
  const [busy, setBusy] = useState(false);

  // A saved controller resumes its own team; watching this page must not
  // accidentally claim the opposite team or overwrite saved slot names.
  useEffect(() => {
    if (code && readSession(code)) router.replace(`/lobby/${code}`);
  }, [code, router]);

  const handlePickerConfirm = async (data: {
    team: Team;
    teamName: string;
    characters: [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
  }) => {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const previous = readSession(code);
      const result = await emit<JoinResult>('team:join', {
        code,
        team: data.team,
        teamName: data.teamName,
        characters: data.characters,
        ready: true,
        ...(previous ? { token: previous.token } : {}),
      });

      saveSession(code, {
        token: result.token,
        team: data.team,
        teamId: result.teamId,
        teamName: data.teamName,
        characters: data.characters,
      });

      await emit('team:ready', { code, ready: true });
      playSound('ready');
      router.push(
        ['WAITING', 'READY'].includes(result.state.phase) ? `/lobby/${code}` : `/play/${code}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengonfirmasi tim. Silakan coba kembali.');
      setBusy(false);
    }
  };

  if (!code) {
    return (
      <div className="player-page">
        <GameHeader connected={true} />
        <main className="code-entry card">
          <div className="code-entry-icon">
            <Users size={32} />
          </div>
          <p className="eyebrow">HEALTHCARE HEROES QUIZ BATTLE</p>
          <h1>Arena Dua Tim Menunggumu.</h1>
          <p className="muted">
            Masukkan kode room dari host untuk mengendalikan Tim Hijau atau Tim Biru.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim()) {
                router.push(`/join/${encodeURIComponent(codeInput.trim().toUpperCase())}`);
              }
            }}
          >
            <label className="field">
              Kode room
              <input
                autoFocus
                className="input code-input"
                placeholder="MED729"
                value={codeInput}
                maxLength={12}
                onChange={(e) =>
                  setCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                }
                required
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Temukan pertandingan <ArrowRight size={17} />
            </button>
          </form>
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Kembali ke beranda
          </Link>
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="player-page">
        <GameHeader connected={connected} code={code} />
        <main className="game-loading card">
          {loading && <span className="spinner" />}
          <h2>{loading ? 'Menghubungkan ke arena…' : 'Room belum tersedia'}</h2>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Link href="/join" className="back-link">
            <ArrowLeft size={15} /> Masukkan kode lain
          </Link>
        </main>
      </div>
    );
  }

  if (!['WAITING', 'READY'].includes(state.phase)) {
    return (
      <div className="player-page">
        <GameHeader connected={connected} code={code} />
        <main className="game-loading card">
          <h2>Pertandingan sudah dimulai</h2>
          <p>
            Komposisi hero sudah dikunci. Gunakan perangkat pengendali yang telah bergabung untuk
            melanjutkan.
          </p>
          <Link href={`/display/${code}`} className="btn btn-primary">
            Lihat pertandingan <ArrowRight size={16} />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <TeamCharacterPicker
      roomCode={code}
      roomTitle={state.title}
      packageName={state.packageName}
      initialTeam={team}
      initialTeamName={state.teams[team].name}
      initialCharacters={state.teams[team].characters}
      teams={state.teams}
      busy={busy}
      connected={connected}
      error={error}
      onTeamChange={setTeam}
      onConfirm={handlePickerConfirm}
    />
  );
}

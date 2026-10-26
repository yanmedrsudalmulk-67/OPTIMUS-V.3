'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import {
  defaultTeamCharacters,
  type JoinResult,
  type Team,
  type TeamCharacterSlot,
} from '@shared/index';
import { emit, getSocket } from '../../lib/socket';
import { playSound } from '../../lib/audio';
import { GameHeader } from './RoomParts';
import { readSession, saveSession, sessionKey, useRoom } from './useRoom';
import TeamCharacterPicker from './TeamCharacterPicker';
import './game.css';

export default function JoinGame({ code: initialCode = '' }: { code?: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const code = initialCode.toUpperCase();
  const { state, connected, loading, error, setError } = useRoom(code);

  const [team, setTeam] = useState<Team>('A');
  const [teamName, setTeamName] = useState('Tim Hijau');
  const [characters, setCharacters] = useState<[TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot]>(
    defaultTeamCharacters('A'),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const clearSaved = () => {
    localStorage.removeItem(sessionKey(code));
    const socket = getSocket();
    socket.auth = { ...socket.auth, playerToken: undefined };
    setSaved(false);
    setError('');
  };

  // Sync team initial details from room state
  useEffect(() => {
    if (!state) return;
    const tObj = state.teams?.[team];
    if (tObj) {
      if (!saved) {
        setTeamName(tObj.name || (team === 'A' ? state.teamAName : state.teamBName));
        if (tObj.characters && tObj.characters.length === 3) {
          setCharacters([...tObj.characters] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot]);
        }
      }
    }
  }, [state, team, saved]);

  // Load previous session
  useEffect(() => {
    if (!code) return;
    const previous = readSession(code);
    if (previous) {
      setTeam(previous.team || 'A');
      if (previous.teamName) setTeamName(previous.teamName);
      if (previous.characters && previous.characters.length === 3) {
        setCharacters(previous.characters as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot]);
      }
      setSaved(true);
    }
  }, [code]);

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
          <p className="muted">Masukkan kode room dari host untuk mengendalikan Tim Hijau atau Tim Biru.</p>
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

  return (
    <div className="player-page" style={{ background: '#0a174e', minHeight: '100vh', padding: '12px 10px 40px' }}>
      <TeamCharacterPicker
        roomCode={code}
        roomTitle={state?.title}
        packageName={state?.packageName}
        initialTeam={team}
        initialTeamName={teamName}
        initialCharacters={characters}
        busy={busy}
        connected={connected}
        error={error}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
}

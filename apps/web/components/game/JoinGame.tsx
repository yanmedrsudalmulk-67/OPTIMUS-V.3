'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { CHARACTERS, type JoinResult, type Team } from '@shared/index';
import { emit, getSocket } from '../../lib/socket';
import { playSound } from '../../lib/audio';
import { GameHeader } from './RoomParts';
import { readSession, saveSession, sessionKey, useRoom } from './useRoom';
import './game.css';

const CharacterPreview = dynamic(() => import('../arena/CharacterPreview'), {
  ssr: false,
  loading: () => (
    <div className="character-loading">
      <span className="spinner" />
      Menyiapkan hero…
    </div>
  ),
});
export default function JoinGame({ code: initialCode = '' }: { code?: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const code = initialCode.toUpperCase();
  const { state, connected, loading, error, setError } = useRoom(code);
  const [name, setName] = useState('');
  const [team, setTeam] = useState<Team>('A');
  const [characterIndex, setCharacterIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const character = CHARACTERS[characterIndex];
  const [saved, setSaved] = useState(false);
  const clearSaved = () => {
    localStorage.removeItem(sessionKey(code));
    const socket = getSocket();
    socket.auth = { ...socket.auth, playerToken: undefined };
    setSaved(false);
    setError('');
  };
  useEffect(() => {
    if (!code) return;
    const previous = readSession(code);
    if (previous) {
      setName(previous.name);
      setTeam(previous.team);
      setCharacterIndex(
        Math.max(
          0,
          CHARACTERS.findIndex((c) => c.id === previous.characterId),
        ),
      );
      setSaved(true);
    }
  }, [code]);
  const count = (t: Team) => state?.players.filter((p) => p.team === t).length || 0;
  const changeCharacter = (direction: number) => {
    setCharacterIndex((i) => (i + direction + CHARACTERS.length) % CHARACTERS.length);
    playSound('select');
  };
  const join = async () => {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const previous = readSession(code);
      const result = await emit<JoinResult>('room:join', {
        code,
        name: name.trim(),
        team,
        characterId: character.id,
        ...(previous ? { token: previous.token } : {}),
      });
      const joinedPlayer = result.state.players.find((p) => p.id === result.playerId);
      saveSession(code, {
        token: result.token,
        playerId: result.playerId,
        name: name.trim(),
        team: joinedPlayer?.team || team,
        characterId: character.id,
      });
      if (previous && ['WAITING', 'READY'].includes(result.state.phase))
        await emit('player:select-character', {
          code,
          name: name.trim(),
          characterId: character.id,
        });
      if (['WAITING', 'READY'].includes(result.state.phase))
        await emit('player:set-ready', { code, ready: true });
      playSound('ready');
      router.push(
        ['WAITING', 'READY'].includes(result.state.phase) ? `/lobby/${code}` : `/play/${code}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung. Coba kembali.');
      setBusy(false);
    }
  };
  if (!code)
    return (
      <div className="player-page">
        <GameHeader connected={true} />
        <main className="code-entry card">
          <div className="code-entry-icon">
            <Users size={32} />
          </div>
          <p className="eyebrow">HEALTHCARE HEROES QUIZ BATTLE</p>
          <h1>Arena menunggumu.</h1>
          <p className="muted">Masukkan kode room dari host untuk bergabung bersama timmu.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim())
                router.push(`/join/${encodeURIComponent(codeInput.trim().toUpperCase())}`);
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
  return (
    <div className="player-page">
      <GameHeader connected={connected} code={code} />
      <main className="join-layout">
        <section className="join-intro">
          <Link href="/join" className="back-link">
            <ArrowLeft size={16} /> Ganti room
          </Link>
          <p className="eyebrow">PILIH HERO. BENTUK TIM. TARIK KEMENANGAN.</p>
          <h1>
            Setiap hero punya
            <br />
            <em>kekuatan sendiri.</em>
          </h1>
          <p className="muted">
            Bawa pengetahuanmu ke arena. Pilih karakter dan bersiap untuk pertarungan yang seru.
          </p>
          <div
            className="character-stage"
            style={{ '--hero-color': character.color } as React.CSSProperties}
          >
            <span className="hero-number">
              {String(characterIndex + 1).padStart(2, '0')} <small>/ 08</small>
            </span>
            <div className="preview-canvas">
              <CharacterPreview characterId={character.id} team={team} />
            </div>
            <div className="character-navigation">
              <button aria-label="Karakter sebelumnya" onClick={() => changeCharacter(-1)}>
                <ChevronLeft size={23} />
              </button>
              <div>
                <h2>{character.name}</h2>
                <span>{character.profession}</span>
              </div>
              <button aria-label="Karakter berikutnya" onClick={() => changeCharacter(1)}>
                <ChevronRight size={23} />
              </button>
            </div>
            <p className="character-description">{character.description}</p>
            <div className="character-dots">
              {CHARACTERS.map((c, i) => (
                <button
                  key={c.id}
                  aria-label={`Pilih ${c.name}`}
                  className={i === characterIndex ? 'active' : ''}
                  onClick={() => {
                    setCharacterIndex(i);
                    playSound('select');
                  }}
                />
              ))}
            </div>
            <small className="drag-hint">Geser karakter untuk melihat dari semua sisi</small>
          </div>
        </section>
        <section className="join-card card">
          <span className="badge badge-green">
            <span className="status-dot" /> ROOM {code}
          </span>
          <h2>{state?.title || 'Menyiapkan pertandingan…'}</h2>
          <p className="muted">{state?.packageName || 'Terhubung dengan arena'}</p>
          {loading && (
            <p className="loading-line">
              <span className="spinner" />
              Mengambil data room…
            </p>
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
              {saved && (
                <button type="button" className="text-button" onClick={clearSaved}>
                  Hapus sesi lama dan bergabung kembali
                </button>
              )}
            </div>
          )}
          {state && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void join();
              }}
            >
              <label className="field">
                Nama pemain
                <input
                  className="input"
                  placeholder="Siapa nama hero kita?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  minLength={2}
                  required
                  autoComplete="nickname"
                />
              </label>
              <label className="field">Pilih timmu</label>
              <div className="team-picker">
                {(['A', 'B'] as Team[]).map((t) => {
                  const full = count(t) >= 3 && !saved;
                  return (
                    <button
                      type="button"
                      disabled={full}
                      key={t}
                      className={`team-choice team-${t.toLowerCase()} ${team === t ? 'selected' : ''}`}
                      onClick={() => setTeam(t)}
                    >
                      <span className="team-choice-check">
                        {team === t ? <Check size={15} /> : <span />}
                      </span>
                      <ShieldCheck size={29} />
                      <strong>{t === 'A' ? state.teamAName : state.teamBName}</strong>
                      <small>{full ? 'Tim penuh' : `${count(t)}/3 pemain`}</small>
                    </button>
                  );
                })}
              </div>
              <div className="selected-hero">
                <span style={{ background: character.color }} />
                <div>
                  <small>HERO PILIHANMU</small>
                  <strong>
                    {character.name} · {character.profession}
                  </strong>
                </div>
                <Check size={17} />
              </div>
              <button
                className="btn btn-primary join-ready"
                disabled={
                  busy ||
                  !connected ||
                  (!saved && (state.locked || !['WAITING', 'READY'].includes(state.phase))) ||
                  name.trim().length < 2
                }
                type="submit"
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Menghubungkan…
                  </>
                ) : (
                  <>
                    {saved ? 'Kembali ke pertandingan' : 'Saya siap bertanding'}
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
              {state.locked && !saved && <p className="muted">Lobby dikunci oleh host.</p>}
              {!['WAITING', 'READY'].includes(state.phase) && !saved && (
                <p className="muted">
                  Pertandingan sudah dimulai. <Link href={`/display/${code}`}>Tonton arena</Link>
                </p>
              )}
              <p className="join-disclaimer">
                <ShieldCheck size={14} /> Tidak perlu akun. Cukup semangat dan kerja sama.
              </p>
            </form>
          )}
        </section>
      </main>
      <footer className="game-footer">
        MEDICAL TUG OF WAR <span>Pengetahuan jadi kekuatan.</span>
      </footer>
    </div>
  );
}

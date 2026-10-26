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
  Edit2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  CHARACTERS,
  defaultTeamCharacters,
  type JoinResult,
  type Team,
  type TeamCharacterSlot,
} from '@shared/index';
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
      <span>Menyiapkan 3D hero…</span>
    </div>
  ),
});

export default function JoinGame({ code: initialCode = '' }: { code?: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const code = initialCode.toUpperCase();
  const { state, connected, loading, error, setError } = useRoom(code);

  const [team, setTeam] = useState<Team>('A');
  const [teamName, setTeamName] = useState('Tim Emerald');
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [characters, setCharacters] = useState<[TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot]>(
    defaultTeamCharacters('A'),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeChar = characters[selectedSlot] || characters[0];
  const activeDef = CHARACTERS.find((c) => c.id === activeChar.characterId) || CHARACTERS[0];

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
          setCharacters([...tObj.characters] as any);
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
        setCharacters(previous.characters as any);
      }
      setSaved(true);
    }
  }, [code]);

  const handleTeamChange = (newTeam: Team) => {
    setTeam(newTeam);
    playSound('click');
    if (!saved) {
      const defaultName = newTeam === 'A' ? (state?.teamAName || 'Tim Emerald') : (state?.teamBName || 'Tim Sapphire');
      setTeamName(defaultName);
      const defaults = defaultTeamCharacters(newTeam);
      setCharacters(defaults);
      setSelectedSlot(0);
    }
  };

  const updateActiveCharacterId = (newId: string) => {
    const def = CHARACTERS.find((c) => c.id === newId);
    if (!def) return;
    playSound('select');
    setCharacters((prev) => {
      const updated = [...prev] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      updated[selectedSlot] = {
        slot: selectedSlot,
        characterId: newId,
        name: def.name,
      };
      return updated;
    });
  };

  const updateActiveCharacterName = (newName: string) => {
    setCharacters((prev) => {
      const updated = [...prev] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      updated[selectedSlot] = {
        ...updated[selectedSlot],
        name: newName,
      };
      return updated;
    });
  };

  const cycleCharacter = (direction: number) => {
    const currentIndex = CHARACTERS.findIndex((c) => c.id === activeChar.characterId);
    const nextIndex = (currentIndex + direction + CHARACTERS.length) % CHARACTERS.length;
    updateActiveCharacterId(CHARACTERS[nextIndex].id);
  };

  const confirmTeamAndReady = async () => {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const previous = readSession(code);
      const result = await emit<JoinResult>('team:join', {
        code,
        team,
        teamName: teamName.trim(),
        characters,
        ready: true,
        ...(previous ? { token: previous.token } : {}),
      });

      saveSession(code, {
        token: result.token,
        team,
        teamId: result.teamId,
        teamName: teamName.trim(),
        characters,
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

  const teamConnected = state?.teams?.[team]?.connected;

  return (
    <div className="player-page">
      <GameHeader connected={connected} code={code} />
      <main className="join-layout team-selection-layout">
        {/* Left Side: 3D Character Preview Stage */}
        <section className="join-intro">
          <div className="team-header-pill">
            <span className={`status-dot ${team === 'A' ? 'dot-green' : 'dot-blue'}`} />
            <span>PENGENDALI TIM {team === 'A' ? 'A (HIJAU)' : 'B (BIRU)'}</span>
          </div>

          <h1 className="select-team-title">
            SELECT YOUR TEAM
            <br />
            <em>CHOOSE 3 HEROES</em>
          </h1>
          <p className="muted">
            Pilih dan konfigurasikan tiga hero medis yang akan menarik tali kemenangan bersama timmu.
          </p>

          <div
            className="character-stage"
            style={{ '--hero-color': activeDef.color } as React.CSSProperties}
          >
            <span className="hero-number">
              SLOT {selectedSlot + 1} <small>/ 03</small>
            </span>

            <div className="preview-canvas">
              <CharacterPreview characterId={activeChar.characterId} team={team} />
            </div>

            <div className="character-navigation">
              <button aria-label="Hero sebelumnya" onClick={() => cycleCharacter(-1)}>
                <ChevronLeft size={24} />
              </button>
              <div>
                <h2>{activeChar.name}</h2>
                <span className="hero-profession">{activeDef.profession}</span>
              </div>
              <button aria-label="Hero berikutnya" onClick={() => cycleCharacter(1)}>
                <ChevronRight size={24} />
              </button>
            </div>

            <p className="character-description">{activeDef.description}</p>
            <small className="drag-hint">Geser karakter 3D untuk melihat dari segala sudut</small>
          </div>
        </section>

        {/* Right Side: Team & 3 Character Slots Configuration */}
        <section className="join-card card team-config-card">
          <span className="badge badge-green">
            <span className="status-dot" /> ROOM {code}
          </span>
          <h2>{state?.title || 'Menyiapkan pertandingan…'}</h2>
          <p className="muted">{state?.packageName || 'Mode 2 Team Controllers'}</p>

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
                  Hapus sesi lama dan buat tim baru
                </button>
              )}
            </div>
          )}

          {state && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void confirmTeamAndReady();
              }}
            >
              {/* Step 1: Team Selection Buttons */}
              <label className="field">Pilih Tim Pengendali</label>
              <div className="team-picker">
                {(['A', 'B'] as Team[]).map((t) => {
                  const tState = state.teams?.[t];
                  const isTaken = Boolean(tState?.connected && (!saved || (saved && readSession(code)?.team !== t)));
                  return (
                    <button
                      type="button"
                      disabled={isTaken}
                      key={t}
                      className={`team-choice team-${t.toLowerCase()} ${team === t ? 'selected' : ''}`}
                      onClick={() => handleTeamChange(t)}
                    >
                      <span className="team-choice-check">
                        {team === t ? <Check size={16} /> : <span />}
                      </span>
                      <ShieldCheck size={28} />
                      <strong>{t === 'A' ? (state.teams?.A.name || 'Tim Emerald') : (state.teams?.B.name || 'Tim Sapphire')}</strong>
                      <small>{isTaken ? 'Pengendali Terhubung' : (team === t ? 'Tim Anda' : 'Tersedia')}</small>
                    </button>
                  );
                })}
              </div>

              {/* Step 2: Team Name */}
              <label className="field">
                Nama Tim Anda
                <input
                  className="input"
                  placeholder="Contoh: Infection Fighters"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={40}
                  minLength={1}
                  required
                />
              </label>

              {/* Step 3: 3 Character Slots */}
              <div className="three-slots-section">
                <label className="field">Konfigurasi 3 Hero Tim</label>
                <div className="slots-grid">
                  {characters.map((slotChar, idx) => {
                    const charDef = CHARACTERS.find((c) => c.id === slotChar.characterId) || CHARACTERS[0];
                    const isSelected = selectedSlot === idx;
                    return (
                      <div
                        key={idx}
                        className={`slot-card ${isSelected ? 'active-slot' : ''}`}
                        onClick={() => {
                          setSelectedSlot(idx);
                          playSound('click');
                        }}
                      >
                        <div className="slot-badge">SLOT 0{idx + 1}</div>
                        <div className="slot-avatar" style={{ background: charDef.color }}>
                          <span className="slot-avatar-initial">{charDef.name[0]}</span>
                        </div>
                        <strong className="slot-name">{slotChar.name}</strong>
                        <small className="slot-prof">{charDef.profession}</small>
                      </div>
                    );
                  })}
                </div>

                {/* Edit Active Slot Name & Profession Gallery */}
                <div className="active-slot-editor">
                  <div className="active-slot-title">
                    <Edit2 size={14} />
                    <span>Ubah Slot 0{selectedSlot + 1}: {activeDef.profession}</span>
                  </div>

                  <label className="field">
                    Nama Hero Slot 0{selectedSlot + 1}
                    <input
                      className="input"
                      value={activeChar.name}
                      onChange={(e) => updateActiveCharacterName(e.target.value)}
                      maxLength={30}
                      minLength={1}
                      placeholder="Contoh: Dr. Adi"
                    />
                  </label>

                  <div className="character-gallery-chips">
                    <small className="muted gallery-label">Pilih Karakter dari Galeri:</small>
                    <div className="chips-container">
                      {CHARACTERS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`chip-button ${c.id === activeChar.characterId ? 'chip-selected' : ''}`}
                          onClick={() => updateActiveCharacterId(c.id)}
                        >
                          <span className="chip-dot" style={{ background: c.color }} />
                          <span>{c.profession} ({c.name.split(' ')[0]})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Confirm Team & Ready Button */}
              <button
                className="btn btn-primary join-ready"
                disabled={
                  busy ||
                  !connected ||
                  teamName.trim().length < 1 ||
                  characters.some((c) => !c.name.trim())
                }
                type="submit"
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Menyimpan Konfigurasi Tim…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    CONFIRM TEAM & READY
                    <ArrowRight size={19} />
                  </>
                )}
              </button>

              <p className="join-disclaimer">
                <ShieldCheck size={14} /> 1 Perangkat mengendalikan 1 Tim penuh (3 hero sekaligus).
              </p>
            </form>
          )}
        </section>
      </main>

      <footer className="game-footer">
        MEDICAL TUG OF WAR <span>2 Team Controllers · 6 Heroes · 1 Shared Arena</span>
      </footer>
    </div>
  );
}

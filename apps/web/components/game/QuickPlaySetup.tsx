'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Heart,
  Play,
  Shuffle,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import {
  CHARACTERS,
  defaultTeamCharacters,
  type RoomState,
  type Team,
  type TeamCharacterSlot,
} from '../../../../packages/shared/src';
import { api } from '../../lib/api';
import { configureAudio, playSound } from '../../lib/audio';
import {
  DEFAULT_GAME_PREFS,
  readGamePrefs,
  saveGamePrefs,
  saveQuickSession,
  type PublicPackageSummary,
  type QuickPlayMode,
} from '../../lib/gamePrefs';
import './quick-play.css';

const CharacterPreview = dynamic(() => import('../arena/CharacterPreview'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#7dd3fc', fontSize: 12 }}>
      Menyiapkan 3D Hero…
    </div>
  ),
});

type Slots = [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];

const STAT_BARS = [
  { key: 'care', label: 'Care', color: '#34d399' },
  { key: 'teamwork', label: 'Teamwork', color: '#38bdf8' },
  { key: 'knowledge', label: 'Knowledge', color: '#facc15' },
  { key: 'resilience', label: 'Resilience', color: '#a78bfa' },
] as const;

export default function QuickPlaySetup() {
  const router = useRouter();
  const [teamAName, setTeamAName] = useState('Tim Hijau');
  const [teamBName, setTeamBName] = useState('Tim Biru');
  const [teamAChars, setTeamAChars] = useState<Slots>(() => defaultTeamCharacters('A'));
  const [teamBChars, setTeamBChars] = useState<Slots>(() => defaultTeamCharacters('B'));
  const [focus, setFocus] = useState<{ team: Team; slot: number }>({ team: 'A', slot: 0 });
  const [packages, setPackages] = useState<PublicPackageSummary[]>([]);
  const [packageId, setPackageId] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_GAME_PREFS.questionCount);
  const [arena, setArena] = useState<'hospital' | 'fantasy'>(DEFAULT_GAME_PREFS.arena);
  const [playMode, setPlayMode] = useState<QuickPlayMode>(DEFAULT_GAME_PREFS.playMode);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const prefs = readGamePrefs();
    setArena(prefs.arena);
    setPackageId(prefs.packageId);
    setQuestionCount(prefs.questionCount);
    setPlayMode(prefs.playMode);
    configureAudio({ sound: prefs.sound, music: prefs.music, volume: prefs.volume });

    api<{ packages: PublicPackageSummary[] }>('/public/packages')
      .then((res) => {
        setPackages(res.packages);
        if (res.packages.length > 0) {
          setPackageId((cur) =>
            cur && res.packages.some((p) => p.id === cur) ? cur : res.packages[0].id,
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat paket soal.'));
  }, []);

  const focusedHeroId = useMemo(() => {
    const slots = focus.team === 'A' ? teamAChars : teamBChars;
    return slots[focus.slot]?.characterId || CHARACTERS[0].id;
  }, [focus, teamAChars, teamBChars]);

  const focusedDef = useMemo(
    () => CHARACTERS.find((c) => c.id === focusedHeroId) || CHARACTERS[0],
    [focusedHeroId],
  );

  const assignHero = (heroId: string) => {
    const def = CHARACTERS.find((c) => c.id === heroId);
    if (!def) return;
    playSound('select');

    const update = (prev: Slots) =>
      prev.map((item) =>
        item.slot === focus.slot ? { ...item, characterId: def.id, name: def.name } : item,
      ) as Slots;

    if (focus.team === 'A') setTeamAChars(update);
    else setTeamBChars(update);

    // Smooth sequential draft progression across both teams (A0 -> A1 -> A2 -> B0 -> B1 -> B2)
    if (focus.slot < 2) {
      setFocus({ team: focus.team, slot: focus.slot + 1 });
    } else if (focus.team === 'A') {
      setFocus({ team: 'B', slot: 0 });
    }
  };

  const randomizeSquads = () => {
    playSound('click');
    const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
    setTeamAChars([
      { slot: 0, characterId: pool[0].id, name: pool[0].name },
      { slot: 1, characterId: pool[1].id, name: pool[1].name },
      { slot: 2, characterId: pool[2].id, name: pool[2].name },
    ]);
    setTeamBChars([
      { slot: 0, characterId: pool[3].id, name: pool[3].name },
      { slot: 1, characterId: pool[4].id, name: pool[4].name },
      { slot: 2, characterId: pool[5].id, name: pool[5].name },
    ]);
  };

  const startBattle = async () => {
    if (launching) return;
    setLaunching(true);
    setError('');
    try {
      const prefs = saveGamePrefs({
        arena,
        packageId,
        questionCount,
        playMode,
      });

      const res = await api<{ state: RoomState; quickToken: string }>('/quick-matches', {
        method: 'POST',
        body: JSON.stringify({
          title: `${teamAName.trim() || 'Tim Hijau'} vs ${teamBName.trim() || 'Tim Biru'}`,
          teamAName: teamAName.trim() || 'Tim Hijau',
          teamBName: teamBName.trim() || 'Tim Biru',
          ...(packageId ? { packageId } : {}),
          teamACharacters: teamAChars,
          teamBCharacters: teamBChars,
          settings: {
            arena,
            questionCount,
            duration: prefs.duration,
            autoClose: true,
            countdownSeconds: 3,
            revealSeconds: 2,
            pullSeconds: 2,
            resultSeconds: 1,
            quality: prefs.quality,
            sound: prefs.sound,
            music: prefs.music,
            volume: prefs.volume,
          },
          autoStart: true,
        }),
      });

      saveQuickSession({
        code: res.state.code,
        quickToken: res.quickToken,
        mode: playMode,
        title: res.state.title,
        updatedAt: Date.now(),
      });

      playSound('start');
      router.push(`/battle/${res.state.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulai pertandingan.');
      setLaunching(false);
    }
  };

  return (
    <div className="qp-shell">
      {/* TOP BAR */}
      <header className="qp-topbar">
        <Link href="/" className="qp-back-btn">
          <ArrowLeft size={16} /> MENU UTAMA
        </Link>

        <div className="qp-title-group">
          <small>HEALTHCARE HEROES • 3 VS 3 QUIZ BATTLE</small>
          <h1>
            PILIH KARAKTER <em>2 TIM</em>
          </h1>
        </div>

        <div className="qp-controls-bar">
          <select
            aria-label="Pilih paket soal"
            className="qp-select"
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value);
              saveGamePrefs({ packageId: e.target.value });
            }}
          >
            {packages.length === 0 ? (
              <option value="">Paket Soal Default</option>
            ) : (
              packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.questionCount} soal)
                </option>
              ))
            )}
          </select>

          <select
            aria-label="Jumlah soal"
            className="qp-select"
            value={questionCount}
            onChange={(e) => {
              const count = Number(e.target.value);
              setQuestionCount(count);
              saveGamePrefs({ questionCount: count });
            }}
          >
            <option value={5}>5 Soal</option>
            <option value={10}>10 Soal</option>
            <option value={20}>Maks 20 Soal</option>
          </select>

          <button
            type="button"
            className={`qp-pill ${arena === 'hospital' ? 'is-active' : ''}`}
            onClick={() => {
              const next = arena === 'hospital' ? 'fantasy' : 'hospital';
              setArena(next);
              saveGamePrefs({ arena: next });
              playSound('select');
            }}
          >
            {arena === 'hospital' ? <Heart size={14} /> : <Swords size={14} />}
            {arena === 'hospital' ? 'Hospital' : 'Fantasy'}
          </button>

          <button
            type="button"
            className={`qp-pill ${playMode === 'bot' ? 'is-bot' : 'is-active'}`}
            onClick={() => {
              const next = playMode === 'local' ? 'bot' : 'local';
              setPlayMode(next);
              saveGamePrefs({ playMode: next });
              playSound('select');
            }}
          >
            {playMode === 'local' ? <Users size={14} /> : <Bot size={14} />}
            {playMode === 'local' ? '2 Tim Lokal' : 'VS Bot AI'}
          </button>

          <button type="button" className="qp-pill" onClick={randomizeSquads} title="Acak Squad">
            <Shuffle size={14} /> Acak
          </button>
        </div>
      </header>

      {error && (
        <div className="qp-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* MAIN 3-COLUMN SQUAD SELECTION */}
      <main className="qp-main-grid">
        {/* TIM A (HIJAU) */}
        <section className="qp-team-panel team-a" aria-label="Pilih karakter Tim Hijau">
          <div className="qp-team-head">
            <span className="qp-team-tag">TIM 1 • EMERALD</span>
            <small style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700 }}>
              Tombol Jawab: 1–4
            </small>
          </div>
          <input
            aria-label="Nama Tim Hijau"
            className="qp-team-name-input"
            maxLength={40}
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
          />
          <div className="qp-slots-col">
            {teamAChars.map((slot) => {
              const def = CHARACTERS.find((c) => c.id === slot.characterId) || CHARACTERS[0];
              const isFocused = focus.team === 'A' && focus.slot === slot.slot;
              return (
                <button
                  key={`A-${slot.slot}`}
                  type="button"
                  className={`qp-slot-card ${isFocused ? 'is-focused' : ''}`}
                  style={{ '--hero-color': def.color } as CSSProperties}
                  onClick={() => {
                    setFocus({ team: 'A', slot: slot.slot });
                    playSound('select');
                  }}
                >
                  <div className="qp-slot-avatar">
                    <span className="qp-slot-num">0{slot.slot + 1}</span>
                    <img src={def.thumbnailPath} alt={def.name} draggable={false} />
                  </div>
                  <div className="qp-slot-meta">
                    <strong>{slot.name}</strong>
                    <span>{def.title}</span>
                    <small>{def.profession}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* CENTER 3D HERO SPOTLIGHT */}
        <section
          className="qp-center-stage"
          style={{ '--hero-color': focusedDef.color } as CSSProperties}
          aria-label="Pratinjau Hero 3D"
        >
          <span className="qp-focus-pill">
            <Sparkles size={13} />
            MEMILIH: {focus.team === 'A' ? teamAName || 'TIM HIJAU' : teamBName || 'TIM BIRU'} · SLOT
            0{focus.slot + 1}
          </span>

          <div className="qp-preview-box">
            <CharacterPreview characterId={focusedDef.id} team={focus.team} />
          </div>

          <div className="qp-preview-info">
            <h2>{focusedDef.name}</h2>
            <p>{focusedDef.profession}</p>
            <div className="qp-mini-stats">
              {STAT_BARS.map((stat) => (
                <div className="qp-mini-stat" key={stat.key}>
                  <span>
                    {stat.label}
                    <b>{focusedDef.attributes[stat.key]}</b>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${focusedDef.attributes[stat.key]}%`,
                        background: stat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TIM B (BIRU) */}
        <section className="qp-team-panel team-b" aria-label="Pilih karakter Tim Biru">
          <div className="qp-team-head">
            <span className="qp-team-tag">TIM 2 • SAPPHIRE</span>
            <small style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700 }}>
              {playMode === 'bot' ? '🤖 AI Bot Aktif' : 'Tombol Jawab: 7–0'}
            </small>
          </div>
          <input
            aria-label="Nama Tim Biru"
            className="qp-team-name-input"
            maxLength={40}
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
          />
          <div className="qp-slots-col">
            {teamBChars.map((slot) => {
              const def = CHARACTERS.find((c) => c.id === slot.characterId) || CHARACTERS[0];
              const isFocused = focus.team === 'B' && focus.slot === slot.slot;
              return (
                <button
                  key={`B-${slot.slot}`}
                  type="button"
                  className={`qp-slot-card ${isFocused ? 'is-focused' : ''}`}
                  style={{ '--hero-color': def.color } as CSSProperties}
                  onClick={() => {
                    setFocus({ team: 'B', slot: slot.slot });
                    playSound('select');
                  }}
                >
                  <div className="qp-slot-avatar">
                    <span className="qp-slot-num">0{slot.slot + 1}</span>
                    <img src={def.thumbnailPath} alt={def.name} draggable={false} />
                  </div>
                  <div className="qp-slot-meta">
                    <strong>{slot.name}</strong>
                    <span>{def.title}</span>
                    <small>{def.profession}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* BOTTOM ROSTER STRIP + MULAI GAME CTA */}
      <footer className="qp-bottom-dock">
        <div className="qp-roster-strip" aria-label="Daftar seluruh karakter">
          {CHARACTERS.map((hero) => (
            <button
              key={hero.id}
              type="button"
              className={`qp-hero-tile ${focusedHeroId === hero.id ? 'is-current' : ''}`}
              style={{ '--hero-color': hero.color } as CSSProperties}
              onClick={() => assignHero(hero.id)}
              aria-label={`Pilih ${hero.name} (${hero.profession})`}
            >
              <img src={hero.thumbnailPath} alt="" draggable={false} />
              <strong>{hero.name}</strong>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="qp-start-cta"
          disabled={launching}
          onClick={() => void startBattle()}
        >
          <Play size={20} fill="currentColor" />
          {launching ? 'MENYIAPKAN ARENA…' : 'MULAI GAME!'}
        </button>
      </footer>
    </div>
  );
}

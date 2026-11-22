'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Layers,
  Play,
  Shuffle,
  Sun,
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

type Slots = [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];

function HeroRoleEmblem({ heroId }: { heroId: string }) {
  switch (heroId) {
    case 'doctor-m':
    case 'doctor-f':
      // Medical Caduceus / Staff of Asclepius with Wings
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <path
            d="M18 4v28M18 7c-5-4-11-3-14 1 3 1 6 1 9-1-2 2-5 3-8 3 3 2 8 2 13-1zm0 0c5-4 11-3 14 1-3 1-6 1-9-1 2 2 5 3 8 3-3 2-8 2-13-1z"
            fill="currentColor"
          />
          <path
            d="M13 13c2-2 8-2 10 0s-2 4-5 6-7 4-5 6 8 2 10 0M23 13c-2-2-8-2-10 0s2 4 5 6 7 4 5 6-8 2-10 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="18" cy="4" r="2.2" fill="currentColor" />
        </svg>
      );
    case 'nurse-m':
    case 'nurse-f':
      // Classic Nurse Cap with Medical Cross
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <path
            d="M5 14l4-6h18l4 6-4 12H9L5 14z"
            fill="currentColor"
            opacity="0.95"
          />
          <path
            d="M18 11v8M14 15h8"
            stroke="#062e22"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M8 26h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'midwife':
      // Maternal & Infant Swaddle Emblem
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <circle cx="18" cy="10.5" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path
            d="M11 19c0-4.5 3.2-7.5 7-7.5s7 3 7 7.5c0 6.2-3.5 11.5-7 12.5-3.5-1-7-6.3-7-12.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M12.5 19.5c3 1.5 7.5 1.5 11-1.5M13 24c2.8 1.5 6.8 1.2 9.8-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'pharmacist':
      // Diagonal Two-Tone Capsule Pill
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <g transform="rotate(-40 18 18)">
            <rect
              x="11"
              y="5"
              width="14"
              height="26"
              rx="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
            />
            <path d="M11 18h14v6a7 7 0 0 1-14 0v-6z" fill="currentColor" />
            <line x1="11" y1="18" x2="25" y2="18" stroke="currentColor" strokeWidth="2.2" />
          </g>
        </svg>
      );
    case 'analyst':
      // Laboratory Microscope
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <path
            d="M19 6l5 3-5 9-5-3 5-9zM14 18h9M9 30h18M18 25v5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M21 13c4.2 1.8 6.5 6.4 4.5 10.5-1.4 2.8-4.4 4.5-8 4.5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'ambulance':
      // Star of Life / Emergency Cross
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <path
            d="M15 5h6v9h9v6h-9v9h-6v-9H6v-6h9V5z"
            fill="currentColor"
          />
        </svg>
      );
    case 'surgeon':
      // Precision Surgical Shield & Cross
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <path
            d="M18 4l11 4.5v9c0 7.2-4.7 12.6-11 14.5-6.3-1.9-11-7.3-11-14.5v-9L18 4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
          />
          <path d="M18 11v12M12 17h12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    default:
      // Radiographer / Medical Imaging Pulse Ring
      return (
        <svg viewBox="0 0 36 36" className="qp-role-emblem-svg" aria-hidden="true">
          <circle cx="18" cy="18" r="3.4" fill="currentColor" />
          <circle cx="18" cy="18" r="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="7 4" />
        </svg>
      );
  }
}

function PanelWatermark({ slot, team }: { slot: number; team: Team }) {
  if (slot === 0) {
    // Hospital Building Silhouette with Glowing Medical Cross (matches Top Dominant Panel in Image 1)
    return (
      <svg
        viewBox="0 0 240 180"
        className={`qp-panel-hospital-art ${team === 'B' ? 'is-mirrored' : ''}`}
        aria-hidden="true"
      >
        {/* Main Hospital Tower */}
        <polygon points="22,60 88,36 142,58 142,175 22,175" className="hosp-bldg-main" />
        <polygon points="88,36 142,58 142,175 88,175" className="hosp-bldg-side" />
        {/* Lower Wing */}
        <polygon points="4,88 188,118 188,178 4,178" className="hosp-bldg-wing" />
        {/* Glowing Cross Sign */}
        <g transform="translate(88, 52) skewY(12)">
          <rect x="-4" y="-13" width="8" height="26" rx="1.5" className="hosp-cross-glow" />
          <rect x="-13" y="-4" width="26" height="8" rx="1.5" className="hosp-cross-glow" />
        </g>
        {/* Lit Hospital Windows */}
        <g className="hosp-window-grid" transform="skewY(10)">
          <rect x="26" y="92" width="12" height="16" rx="1" />
          <rect x="44" y="92" width="12" height="16" rx="1" />
          <rect x="62" y="92" width="12" height="16" rx="1" />
          <rect x="80" y="92" width="12" height="16" rx="1" />
          <rect x="98" y="92" width="12" height="16" rx="1" />
          <rect x="116" y="92" width="12" height="16" rx="1" />
          <rect x="26" y="114" width="12" height="16" rx="1" />
          <rect x="44" y="114" width="12" height="16" rx="1" />
          <rect x="62" y="114" width="12" height="16" rx="1" />
          <rect x="80" y="114" width="12" height="16" rx="1" />
          <rect x="98" y="114" width="12" height="16" rx="1" />
          <rect x="116" y="114" width="12" height="16" rx="1" />
        </g>
      </svg>
    );
  }

  if (slot === 1) {
    // Medical Clipboard / Pill Bottle Watermark
    return (
      <svg viewBox="0 0 80 80" className="qp-panel-sub-watermark is-left" aria-hidden="true">
        <g transform="rotate(-12 40 40)">
          <rect x="18" y="14" width="42" height="54" rx="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <rect x="29" y="9" width="20" height="9" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <line x1="27" y1="30" x2="51" y2="30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="27" y1="40" x2="51" y2="40" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="27" y1="50" x2="43" y2="50" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // Slot 2: Resilience / Lab Flasks & Molecular Hexagon Watermark
  return team === 'A' ? (
    <svg viewBox="0 0 80 80" className="qp-panel-sub-watermark is-right" aria-hidden="true">
      <path
        d="M52 24c4-3 10 0 10 6 0 5-4 11-9 14l-5-5c3-2 6-6 6-9 0-2-2-3-4-1l-4 4-4-4c-2-2-5 1-3 5l6 10c4 6 2 15-6 18-8 3-17-2-19-11-2-7 2-15 8-19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 100 80" className="qp-panel-sub-watermark is-right" aria-hidden="true">
      {/* Conical Erlenmeyer Flask + Molecular Hexagon */}
      <path
        d="M22 20h14M26 20v13l-11 22a4 4 0 0 0 3.6 5.8h20.8a4 4 0 0 0 3.6-5.8L32 33V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 49h22" stroke="currentColor" strokeWidth="2" />
      <polygon
        points="74,16 86,23 86,37 74,44 62,37 62,23"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line x1="86" y1="23" x2="95" y2="18" stroke="currentColor" strokeWidth="2" />
      <line x1="74" y1="44" x2="74" y2="54" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EcgWave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden="true">
      <path
        d="M2 18h34l7-8 8 18 9-24 8 24 6-10h44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function QuickPlaySetup() {
  const router = useRouter();
  const rosterRef = useRef<HTMLDivElement>(null);
  const [teamAName, setTeamAName] = useState('TIM HIJAU');
  const [teamBName, setTeamBName] = useState('TIM BIRU');
  const [teamAChars, setTeamAChars] = useState<Slots>(() => defaultTeamCharacters('A'));
  const [teamBChars, setTeamBChars] = useState<Slots>(() => defaultTeamCharacters('B'));
  const [focus, setFocus] = useState<{ team: Team; slot: number }>({ team: 'A', slot: 0 });
  const [packages, setPackages] = useState<PublicPackageSummary[]>([]);
  const [packageId, setPackageId] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_GAME_PREFS.questionCount);
  const [arena, setArena] = useState<'hospital' | 'fantasy' | 'beach'>(DEFAULT_GAME_PREFS.arena);
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

  const assignHero = (heroId: string, advanceFocus = true) => {
    const def = CHARACTERS.find((c) => c.id === heroId);
    if (!def) return;
    playSound('select');

    const update = (prev: Slots) =>
      prev.map((item) =>
        item.slot === focus.slot ? { ...item, characterId: def.id, name: def.name } : item,
      ) as Slots;

    if (focus.team === 'A') setTeamAChars(update);
    else setTeamBChars(update);

    if (advanceFocus) {
      if (focus.slot < 2) {
        setFocus({ team: focus.team, slot: focus.slot + 1 });
      } else if (focus.team === 'A') {
        setFocus({ team: 'B', slot: 0 });
      }
    }
  };

  const stepHero = (dir: -1 | 1) => {
    const idx = CHARACTERS.findIndex((c) => c.id === focusedHeroId);
    const nextIdx = (idx + dir + CHARACTERS.length) % CHARACTERS.length;
    assignHero(CHARACTERS[nextIdx].id, false);
    if (rosterRef.current) {
      rosterRef.current.scrollBy({ left: dir * 120, behavior: 'smooth' });
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
            duration: 5,
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

  const renderComicShield = (team: Team, teamName: string, setTeamName: (v: string) => void, slots: Slots) => {
    const isTeamA = team === 'A';
    return (
      <section
        className={`qp-shield-column ${isTeamA ? 'team-a' : 'team-b'}`}
        aria-label={isTeamA ? 'Pilih karakter Tim Hijau' : 'Pilih karakter Tim Biru'}
      >
        {/* Protruding Top Neon Tab */}
        <div className="qp-shield-top-tab">
          <Users size={14} strokeWidth={2.6} />
          <span>{isTeamA ? 'TIM 1 • EMERALD' : 'TIM 2 • SAPPHIRE'}</span>
        </div>

        {/* Outer Glowing Shield Body */}
        <div className="qp-shield-outer">
          <div className="qp-shield-inner">
            {/* Metallic Silver/White Angled Team Name Banner */}
            <div className="qp-shield-name-banner">
              <input
                aria-label={isTeamA ? 'Nama Tim Hijau' : 'Nama Tim Biru'}
                className="qp-shield-name-input"
                maxLength={40}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>

            {/* 3-Panel Comic Split Collage */}
            <div className="qp-comic-collage">
              {slots.map((slotItem) => {
                const def = CHARACTERS.find((c) => c.id === slotItem.characterId) || CHARACTERS[0];
                const isFocused = focus.team === team && focus.slot === slotItem.slot;
                return (
                  <div
                    key={`${team}-panel-${slotItem.slot}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Slot ${slotItem.slot + 1} ${isTeamA ? 'Tim Hijau' : 'Tim Biru'}: ${slotItem.name} (${def.title})`}
                    className={`qp-comic-panel slot-${slotItem.slot} ${isFocused ? 'is-focused' : ''}`}
                    onClick={() => {
                      setFocus({ team, slot: slotItem.slot });
                      playSound('select');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFocus({ team, slot: slotItem.slot });
                        playSound('select');
                      }
                    }}
                  >
                    <div className="qp-comic-panel-inner">
                      <div className="qp-comic-rays" />
                      <div className="qp-comic-halftone" />
                      <PanelWatermark slot={slotItem.slot} team={team} />

                      <div className="qp-comic-hero-art">
                        <img
                          key={def.id}
                          src={def.poseImagePath}
                          alt={`${def.name} — ${def.profession}`}
                          draggable={false}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (!e.currentTarget.dataset.fallback) {
                              e.currentTarget.dataset.fallback = '1';
                              e.currentTarget.src = def.thumbnailPath;
                            }
                          }}
                        />
                      </div>

                      {/* Skewed Comic Nameplate Badge */}
                      <div className="qp-comic-nameplate">
                        <div className="qp-comic-emblem">
                          <HeroRoleEmblem heroId={def.id} />
                        </div>
                        <div className="qp-comic-name-meta">
                          <strong>{slotItem.name}</strong>
                          <span>{def.title}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Thick Angled White/Silver Comic Gutters */}
              <svg
                className="qp-comic-gutters-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {isTeamA ? (
                  <>
                    {/* Diagonal divider between Slot 0 (top) and Slots 1 & 2 (bottom) */}
                    <line
                      x1="-2"
                      y1="44.5"
                      x2="102"
                      y2="56.5"
                      stroke="#08241d"
                      strokeWidth="3.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="-2"
                      y1="44.5"
                      x2="102"
                      y2="56.5"
                      stroke="#f1f5f9"
                      strokeWidth="1.9"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Angled divider between Slot 1 (bottom-left) and Slot 2 (bottom-right) */}
                    <line
                      x1="54.2"
                      y1="51"
                      x2="38.2"
                      y2="102"
                      stroke="#08241d"
                      strokeWidth="3.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="54.2"
                      y1="51"
                      x2="38.2"
                      y2="102"
                      stroke="#f1f5f9"
                      strokeWidth="1.9"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                ) : (
                  <>
                    {/* Mirrored diagonal divider between Slot 0 (top) and Slots 1 & 2 (bottom) */}
                    <line
                      x1="-2"
                      y1="56.5"
                      x2="102"
                      y2="44.5"
                      stroke="#061e38"
                      strokeWidth="3.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="-2"
                      y1="56.5"
                      x2="102"
                      y2="44.5"
                      stroke="#f1f5f9"
                      strokeWidth="1.9"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Mirrored angled divider between Slot 1 (bottom-left) and Slot 2 (bottom-right) */}
                    <line
                      x1="45.8"
                      y1="51"
                      x2="61.8"
                      y2="102"
                      stroke="#061e38"
                      strokeWidth="3.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="45.8"
                      y1="51"
                      x2="61.8"
                      y2="102"
                      stroke="#f1f5f9"
                      strokeWidth="1.9"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                )}
              </svg>
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="qp-shell">
      {/* ATMOSPHERIC CYBER-MEDICAL HOSPITAL EXTERIOR BACKDROP */}
      <div className="qp-backdrop-scene" aria-hidden="true">
        {/* Left Hospital Wing & Trees */}
        <svg className="qp-bg-flank is-left" viewBox="0 0 220 520" preserveAspectRatio="xMinYMax slice">
          <polygon points="0,120 120,175 120,480 0,480" fill="rgba(11, 38, 72, 0.72)" stroke="rgba(56, 189, 248, 0.35)" strokeWidth="2" />
          <polygon points="0,102 132,162 120,175 0,120" fill="rgba(20, 68, 118, 0.85)" />
          <g transform="translate(65, 198) skewY(22)">
            <rect x="-5" y="-16" width="10" height="32" rx="2" fill="#7dd3fc" />
            <rect x="-16" y="-5" width="32" height="10" rx="2" fill="#7dd3fc" />
          </g>
          <g fill="rgba(250, 204, 21, 0.42)" transform="skewY(20)">
            <rect x="12" y="230" width="14" height="24" rx="1" />
            <rect x="32" y="230" width="14" height="24" rx="1" />
            <rect x="52" y="230" width="14" height="24" rx="1" />
            <rect x="12" y="264" width="14" height="24" rx="1" />
            <rect x="32" y="264" width="14" height="24" rx="1" />
            <rect x="52" y="264" width="14" height="24" rx="1" />
          </g>
          {/* Lush Night Foliage Silhouette */}
          <circle cx="18" cy="430" r="38" fill="#0b3b3c" />
          <circle cx="48" cy="458" r="34" fill="#0f5146" />
          <circle cx="12" cy="485" r="44" fill="#062c2d" />
        </svg>

        {/* Right Hospital Wing & Trees */}
        <svg className="qp-bg-flank is-right" viewBox="0 0 220 520" preserveAspectRatio="xMaxYMax slice">
          <polygon points="220,120 100,175 100,480 220,480" fill="rgba(11, 38, 72, 0.72)" stroke="rgba(56, 189, 248, 0.35)" strokeWidth="2" />
          <polygon points="220,102 88,162 100,175 220,120" fill="rgba(20, 68, 118, 0.85)" />
          <path d="M124 235h22l6-12 7 24 8-30 7 26 5-8h26" fill="none" stroke="#38bdf8" strokeWidth="2.4" />
          {/* Lush Night Foliage Silhouette */}
          <circle cx="202" cy="430" r="38" fill="#0b3b3c" />
          <circle cx="172" cy="458" r="34" fill="#0f5146" />
          <circle cx="208" cy="485" r="44" fill="#062c2d" />
        </svg>
      </div>

      {/* TOP BAR */}
      <header className="qp-topbar">
        <Link href="/" className="qp-back-btn">
          <ArrowLeft size={16} strokeWidth={2.8} /> MENU UTAMA
        </Link>

        <div className="qp-title-cluster">
          <EcgWave className="qp-header-ecg is-left" />
          <div className="qp-title-group">
            <small>HEALTHCARE HEROES • 3 VS 3 QUIZ BATTLE</small>
            <h1>
              PILIH KARAKTER <em>2 TIM</em>
            </h1>
          </div>
          <EcgWave className="qp-header-ecg is-right" />
        </div>

        <div className="qp-controls-bar">
          <div className="qp-select-wrap">
            <FileText size={13} className="qp-select-icon" />
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
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="qp-select-wrap is-compact">
            <Layers size={13} className="qp-select-icon" />
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
          </div>

          <div className="qp-select-wrap">
            {arena === 'hospital' ? (
              <Heart size={13} className="qp-select-icon" />
            ) : arena === 'fantasy' ? (
              <Swords size={13} className="qp-select-icon" />
            ) : (
              <Sun size={13} className="qp-select-icon" />
            )}
            <select
              aria-label="Pilih tema arena"
              className="qp-select"
              value={arena}
              onChange={(e) => {
                const next = e.target.value as 'hospital' | 'fantasy' | 'beach';
                setArena(next);
                saveGamePrefs({ arena: next });
                playSound('select');
              }}
            >
              <option value="hospital">Hospital Battle</option>
              <option value="fantasy">Fantasy Battlefield</option>
              <option value="beach">Arena Pantai</option>
            </select>
          </div>

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
            {playMode === 'local' ? <Users size={13} /> : <Bot size={13} />}
            {playMode === 'local' ? '2 Tim Lokal' : 'VS Bot AI'}
          </button>

          <button type="button" className="qp-pill" onClick={randomizeSquads} title="Acak Squad">
            <Shuffle size={13} /> Acak
          </button>
        </div>
      </header>

      {error && (
        <div className="qp-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* MAIN 3-COLUMN COMIC/ESPORTS VERSUS STAGE */}
      <main className="qp-main-grid">
        {/* LEFT SHIELD: TIM 1 • EMERALD */}
        {renderComicShield('A', teamAName, setTeamAName, teamAChars)}

        {/* CENTER VERSUS & DAFTAR KARAKTER MATRIX */}
        <section className="qp-center-versus" aria-label="Versus dan Ringkasan Karakter Tim">
          {/* Top Faint Medical Cross + Glowing Cyan ECG Wave */}
          <div className="qp-versus-top-bg" aria-hidden="true">
            <div className="qp-bg-holo-cross" />
            <svg viewBox="0 0 260 44" className="qp-center-ecg-line">
              <path
                d="M4 26h62l9-12 9 22 11-28 9 26 7-8h38l7-8 9 22 11-28 9 26 7-8h64"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Neon Hexagonal VS Emblem */}
          <div className="qp-vs-emblem-wrap" aria-hidden="true">
            <div className="qp-vs-flare" />
            <div className="qp-vs-hexagon">
              <div className="qp-vs-hexagon-inner">
                <span className="qp-vs-letters">
                  <b className="vs-v">V</b>
                  <b className="vs-s">S</b>
                </span>
              </div>
            </div>
          </div>

          {/* DAFTAR KARAKTER 2x3 Matrix HUD */}
          <div className="qp-matrix-row">
            <div className="qp-cyber-chevron is-left" aria-hidden="true">
              <span />
              <span />
            </div>

            <div className="qp-matrix-frame">
              <div className="qp-matrix-tab">DAFTAR KARAKTER</div>
              <div className="qp-matrix-grid">
                {/* Row 1: Team A (Emerald) */}
                {teamAChars.map((slotItem) => {
                  const def = CHARACTERS.find((c) => c.id === slotItem.characterId) || CHARACTERS[0];
                  const isFocused = focus.team === 'A' && focus.slot === slotItem.slot;
                  return (
                    <button
                      key={`matrix-A-${slotItem.slot}`}
                      type="button"
                      className={`qp-matrix-cell team-a ${isFocused ? 'is-focused' : ''}`}
                      onClick={() => {
                        setFocus({ team: 'A', slot: slotItem.slot });
                        playSound('select');
                      }}
                      title={`Tim Hijau Slot ${slotItem.slot + 1}: ${slotItem.name}`}
                      aria-label={`Fokus Tim Hijau Slot ${slotItem.slot + 1}: ${slotItem.name}`}
                    >
                      <img src={def.thumbnailPath} alt={def.name} draggable={false} />
                    </button>
                  );
                })}

                {/* Row 2: Team B (Sapphire) */}
                {teamBChars.map((slotItem) => {
                  const def = CHARACTERS.find((c) => c.id === slotItem.characterId) || CHARACTERS[0];
                  const isFocused = focus.team === 'B' && focus.slot === slotItem.slot;
                  return (
                    <button
                      key={`matrix-B-${slotItem.slot}`}
                      type="button"
                      className={`qp-matrix-cell team-b ${isFocused ? 'is-focused' : ''}`}
                      onClick={() => {
                        setFocus({ team: 'B', slot: slotItem.slot });
                        playSound('select');
                      }}
                      title={`Tim Biru Slot ${slotItem.slot + 1}: ${slotItem.name}`}
                      aria-label={`Fokus Tim Biru Slot ${slotItem.slot + 1}: ${slotItem.name}`}
                    >
                      <img src={def.thumbnailPath} alt={def.name} draggable={false} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="qp-cyber-chevron is-right" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>

          {/* Bottom Glowing Medical Cross Badge + Holographic Podium */}
          <div className="qp-center-podium" aria-hidden="true">
            <div className="qp-podium-ecg-row">
              <EcgWave className="qp-podium-ecg" />
              <div className="qp-holo-cross-box">
                <span />
              </div>
              <EcgWave className="qp-podium-ecg" />
            </div>
            <div className="qp-podium-rings">
              <div className="qp-podium-beam" />
              <div className="qp-podium-disc-outer" />
              <div className="qp-podium-disc-inner" />
            </div>
          </div>
        </section>

        {/* RIGHT SHIELD: TIM 2 • SAPPHIRE */}
        {renderComicShield('B', teamBName, setTeamBName, teamBChars)}
      </main>

      {/* BOTTOM ROSTER STRIP + MULAI GAME CTA */}
      <footer className="qp-bottom-dock">
        <div className="qp-roster-container">
          <button
            type="button"
            className="qp-roster-arrow"
            onClick={() => stepHero(-1)}
            aria-label="Karakter sebelumnya"
          >
            <ChevronLeft size={20} strokeWidth={2.8} />
          </button>

          <div
            ref={rosterRef}
            className="qp-roster-strip"
            aria-label="Daftar seluruh karakter"
          >
            {CHARACTERS.map((hero) => {
              const isCurrent = focusedHeroId === hero.id;
              return (
                <button
                  key={hero.id}
                  type="button"
                  className={`qp-hero-tile ${isCurrent ? 'is-current' : ''}`}
                  style={{ '--hero-color': hero.color } as CSSProperties}
                  onClick={() => assignHero(hero.id)}
                  aria-label={`Pilih ${hero.name} (${hero.profession})`}
                >
                  <div className="qp-hero-tile-portrait">
                    <img src={hero.thumbnailPath} alt="" draggable={false} />
                  </div>
                  <strong>{hero.name}</strong>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="qp-roster-arrow"
            onClick={() => stepHero(1)}
            aria-label="Karakter berikutnya"
          >
            <ChevronRight size={20} strokeWidth={2.8} />
          </button>
        </div>

        <button
          type="button"
          className="qp-start-cta"
          disabled={launching}
          onClick={() => void startBattle()}
        >
          <span className="qp-start-cta-inner">
            <Play size={22} fill="currentColor" />
            {launching ? 'MENYIAPKAN ARENA…' : 'MULAI GAME!'}
          </span>
        </button>
      </footer>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, type TouchEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Edit2,
  HeartPulse,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  X,
  Zap,
  Activity,
  Award,
} from 'lucide-react';
import {
  CHARACTERS,
  type CharacterDefinition,
  type Team,
  type TeamCharacterSlot,
} from '../../../../packages/shared/src';
import CharacterPreview from '../arena/CharacterPreview';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';

export interface HeroStats {
  pullPower: number;
  accuracy: number;
  stamina: number;
  specialty: string;
  comicTitle: string;
  color: string;
  badge: string;
}

export const HERO_STATS: Record<string, HeroStats> = {
  'doctor-m': {
    pullPower: 92,
    accuracy: 97,
    stamina: 89,
    specialty: 'Clinical Diagnostics & Infection Control',
    comicTitle: 'CHIEF PHYSICIAN',
    color: '#00e5a3',
    badge: 'SURGEON 01',
  },
  'doctor-f': {
    pullPower: 90,
    accuracy: 99,
    stamina: 91,
    specialty: 'Internal Medicine & Patient Safety',
    comicTitle: 'MASTER DIAGNOSTICIAN',
    color: '#38bdf8',
    badge: 'MD EXPERT',
  },
  'nurse-m': {
    pullPower: 96,
    accuracy: 91,
    stamina: 95,
    specialty: 'Critical Care & Intensive Monitoring',
    comicTitle: 'ICU VANGUARD',
    color: '#10b981',
    badge: 'CARE FORCE',
  },
  'nurse-f': {
    pullPower: 91,
    accuracy: 95,
    stamina: 93,
    specialty: 'Emergency Triage & Wound Protocol',
    comicTitle: 'RAPID RESPONDER',
    color: '#06b6d4',
    badge: 'TRIAGE ELITE',
  },
  'midwife': {
    pullPower: 88,
    accuracy: 96,
    stamina: 94,
    specialty: 'Maternal-Neonatal Resilience Care',
    comicTitle: 'MATERNAL GUARDIAN',
    color: '#f43f5e',
    badge: 'SANCTUARY',
  },
  'pharmacist': {
    pullPower: 87,
    accuracy: 98,
    stamina: 90,
    specialty: 'Therapeutic Formulations & Chemistry',
    comicTitle: 'TACTICAL PHARMACIST',
    color: '#f59e0b',
    badge: 'RX FORMULA',
  },
  'analyst': {
    pullPower: 86,
    accuracy: 100,
    stamina: 88,
    specialty: 'Pathogen Analysis & Precision Diagnostics',
    comicTitle: 'BIO-LAB SPEC-OPS',
    color: '#a855f7',
    badge: 'LAB INTEL',
  },
  'ambulance': {
    pullPower: 98,
    accuracy: 90,
    stamina: 99,
    specialty: 'Frontline Rapid Evacuation & Life Support',
    comicTitle: 'PARAMEDIC JUGGERNAUT',
    color: '#f97316',
    badge: 'FIRST STRIKE',
  },
};

export interface TeamCharacterPickerProps {
  initialTeam?: Team;
  initialTeamName?: string;
  initialCharacters?: [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
  roomCode: string;
  roomTitle?: string;
  packageName?: string;
  busy?: boolean;
  connected?: boolean;
  error?: string;
  isEditMode?: boolean;
  onConfirm: (data: {
    team: Team;
    teamName: string;
    characters: [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
  }) => Promise<void> | void;
  onCancel?: () => void;
}

export default function TeamCharacterPicker({
  initialTeam = 'A',
  initialTeamName,
  initialCharacters,
  roomCode,
  roomTitle,
  packageName,
  busy = false,
  connected = true,
  error,
  isEditMode = false,
  onConfirm,
  onCancel,
}: TeamCharacterPickerProps) {
  const [team, setTeam] = useState<Team>(initialTeam);
  const [teamName, setTeamName] = useState(
    initialTeamName || (initialTeam === 'A' ? 'Tim Hijau' : 'Tim Biru'),
  );

  const [characters, setCharacters] = useState<
    [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot]
  >(
    initialCharacters || [
      { slot: 0, characterId: initialTeam === 'A' ? 'doctor-m' : 'doctor-f', name: initialTeam === 'A' ? 'Dr. Arga' : 'Dr. Maya' },
      { slot: 1, characterId: initialTeam === 'A' ? 'nurse-f' : 'analyst', name: initialTeam === 'A' ? 'Ners Alya' : 'Analis Raka' },
      { slot: 2, characterId: initialTeam === 'A' ? 'ambulance' : 'pharmacist', name: initialTeam === 'A' ? 'Medik Juno' : 'Apt. Dimas' },
    ],
  );

  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [muted, updateMuted] = useState(isAudioMuted);
  const [isEditingName, setIsEditingName] = useState(false);

  // Active character definition
  const currentSlotChar = characters[selectedSlot] || characters[0];
  const initialIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === currentSlotChar.characterId),
  );
  const [carouselIndex, setCarouselIndex] = useState(initialIndex);

  // Sync carousel position when active slot changes
  useEffect(() => {
    const slotChar = characters[selectedSlot];
    if (!slotChar) return;
    const idx = CHARACTERS.findIndex((c) => c.id === slotChar.characterId);
    if (idx !== -1) {
      setCarouselIndex(idx);
    }
  }, [selectedSlot]);

  const activeDef: CharacterDefinition = CHARACTERS[carouselIndex] || CHARACTERS[0];
  const activeStats: HeroStats = HERO_STATS[activeDef.id] || {
    pullPower: 90,
    accuracy: 95,
    stamina: 90,
    specialty: 'Healthcare Heroes',
    comicTitle: 'HERO',
    color: '#00e5a3',
    badge: 'SPECIALIST',
  };

  const prevIndex = (carouselIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
  const nextIndex = (carouselIndex + 1) % CHARACTERS.length;
  const prevDef = CHARACTERS[prevIndex];
  const nextDef = CHARACTERS[nextIndex];

  // Touch swipe support for mobile
  const touchStartX = useRef(0);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 45) {
      slideCarousel(-1);
    } else if (deltaX < -45) {
      slideCarousel(1);
    }
  };

  const slideCarousel = (direction: number) => {
    playSound('select');
    const nextIdx = (carouselIndex + direction + CHARACTERS.length) % CHARACTERS.length;
    setCarouselIndex(nextIdx);
    const chosen = CHARACTERS[nextIdx];

    setCharacters((prev) => {
      const copy = [...prev] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      copy[selectedSlot] = {
        slot: selectedSlot,
        characterId: chosen.id,
        name: chosen.name,
      };
      return copy;
    });
    setIsEditingName(false);
  };

  const selectHeroDirectly = (charId: string) => {
    const idx = CHARACTERS.findIndex((c) => c.id === charId);
    if (idx === -1) return;
    playSound('select');
    setCarouselIndex(idx);
    const chosen = CHARACTERS[idx];

    setCharacters((prev) => {
      const copy = [...prev] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      copy[selectedSlot] = {
        slot: selectedSlot,
        characterId: chosen.id,
        name: chosen.name,
      };
      return copy;
    });
    setIsEditingName(false);
  };

  const updateSlotHeroName = (newName: string) => {
    setCharacters((prev) => {
      const copy = [...prev] as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      copy[selectedSlot] = {
        ...copy[selectedSlot],
        name: newName,
      };
      return copy;
    });
  };

  const handleTeamChange = (newTeam: Team) => {
    if (newTeam === team) return;
    playSound('click');
    setTeam(newTeam);
    if (!initialTeamName) {
      setTeamName(newTeam === 'A' ? 'Tim Hijau' : 'Tim Biru');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !connected) return;
    playSound('ready');
    void onConfirm({
      team,
      teamName: teamName.trim() || (team === 'A' ? 'Tim Hijau' : 'Tim Biru'),
      characters,
    });
  };

  return (
    <div className={`comic-select-container team-${team.toLowerCase()}`}>
      {/* BACKGROUND GRAPHIC ACCENTS (Cyber-Comic Neon Angled Glows) */}
      <div className="comic-bg-lines" />
      <div className="comic-bg-slanted-panel" />
      <div className="comic-ambient-glow" />

      {/* TOP HEADER BAR */}
      <header className="comic-topbar">
        <div className="comic-brand-group">
          <div className={`comic-team-avatar ${team === 'A' ? 'avatar-green' : 'avatar-blue'}`}>
            <HeartPulse size={20} />
          </div>
          <div>
            <div className="comic-tagline">HEALTHCARE HEROES · 2 TEAM CONTROLLERS</div>
            <h1 className="comic-main-title">
              {team === 'A' ? 'TEAM GREEN CONTROLLER' : 'TEAM BLUE CONTROLLER'}
            </h1>
          </div>
        </div>

        <div className="comic-topbar-right">
          <div className="comic-pill-room">
            <span className="room-dot" />
            <span>ROOM <b>{roomCode}</b></span>
          </div>

          <button
            type="button"
            className="comic-icon-btn"
            aria-label={muted ? 'Aktifkan Suara' : 'Matikan Suara'}
            onClick={() => {
              updateMuted(!muted);
              setMuted(!muted);
              if (muted) playSound('ready');
            }}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {isEditMode && onCancel && (
            <button
              type="button"
              className="comic-close-btn"
              onClick={onCancel}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* MAIN WIDESCREEN BATTLE LAYOUT (INSPIRED BY JACK UI IMAGE 2) */}
      <div className="comic-widescreen-grid">
        {/* ========================================================
            LEFT COLUMN: FEATURED COMIC 3D HERO SHOWCASE
            ======================================================== */}
        <section className="comic-hero-stage">
          {/* Angled Comic Backdrop */}
          <div className="stage-slanted-card">
            <div className="stage-top-badge">
              <span className="badge-triangle">▲</span>
              <span>{activeStats.badge} · {activeStats.comicTitle}</span>
              <span className="badge-slot">SLOT 0{selectedSlot + 1}</span>
            </div>

            {/* 3D Character Canvas */}
            <div className="stage-3d-wrap">
              <CharacterPreview
                characterId={activeDef.id}
                team={team}
                background="transparent"
              />
            </div>

            {/* Carousel Navigation Chevrons */}
            <button
              type="button"
              className="stage-nav-arrow arrow-prev"
              onClick={() => slideCarousel(-1)}
              aria-label="Karakter Sebelumnya"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              className="stage-nav-arrow arrow-next"
              onClick={() => slideCarousel(1)}
              aria-label="Karakter Berikutnya"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Hero Name & Attributes Box (Matching Image 2) */}
          <div className="stage-hero-meta">
            <div className="hero-title-row">
              {isEditingName ? (
                <div className="inline-name-editor">
                  <input
                    type="text"
                    autoFocus
                    value={currentSlotChar.name}
                    onChange={(e) => updateSlotHeroName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setIsEditingName(false);
                    }}
                    className="inline-name-input"
                    maxLength={25}
                  />
                  <button
                    type="button"
                    className="inline-name-save"
                    onClick={() => setIsEditingName(false)}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="hero-name-badge" onClick={() => setIsEditingName(true)}>
                  <h2 className="hero-display-name">{currentSlotChar.name}</h2>
                  <span className="hero-edit-btn" title="Edit nama hero">
                    <Edit2 size={15} />
                  </span>
                </div>
              )}
              <span className="hero-role-chip" style={{ borderColor: activeDef.color }}>
                {activeDef.profession}
              </span>
            </div>

            <p className="hero-flavor-quote">"{activeDef.description}"</p>

            {/* ATTRIBUTES PANEL (Matching Image 2 Attribute Bars) */}
            <div className="comic-attributes-box">
              <div className="attributes-header">
                <Activity size={14} />
                <span>ATTRIBUTES</span>
              </div>

              <div className="attribute-row">
                <span className="attr-label">DAYA TARIK (PULL FORCE)</span>
                <div className="attr-bar-track">
                  <div
                    className="attr-bar-fill fill-pull"
                    style={{ width: `${activeStats.pullPower}%` }}
                  />
                </div>
                <span className="attr-value">{activeStats.pullPower}</span>
              </div>

              <div className="attribute-row">
                <span className="attr-label">AKURASI MEDIS (KNOWLEDGE)</span>
                <div className="attr-bar-track">
                  <div
                    className="attr-bar-fill fill-acc"
                    style={{ width: `${activeStats.accuracy}%` }}
                  />
                </div>
                <span className="attr-value">{activeStats.accuracy}</span>
              </div>

              <div className="attribute-row">
                <span className="attr-label">STAMINA & FOKUS</span>
                <div className="attr-bar-track">
                  <div
                    className="attr-bar-fill fill-stam"
                    style={{ width: `${activeStats.stamina}%` }}
                  />
                </div>
                <span className="attr-value">{activeStats.stamina}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            RIGHT COLUMN: SQUAD ROSTER, TEAM SLOTS & ACTIONS
            ======================================================== */}
        <section className="comic-squad-panel">
          {/* Header Bar: Team Toggle & Team Name */}
          <div className="squad-panel-header">
            <div className="squad-title-group">
              <span className="squad-eyebrow">CHOOSE 3 HEROES · SQUAD READY</span>
              <h2 className="squad-heading">
                <span className="heading-glyph">▲</span> SQUAD SURVIVOR
              </h2>
            </div>

            {/* Team Toggle Pill */}
            <div className="squad-team-toggles">
              <button
                type="button"
                className={`team-pill-btn ${team === 'A' ? 'active-green' : ''}`}
                onClick={() => handleTeamChange('A')}
              >
                <span className="pill-dot dot-green" />
                <span>TIM HIJAU</span>
                {team === 'A' && <Check size={14} />}
              </button>
              <button
                type="button"
                className={`team-pill-btn ${team === 'B' ? 'active-blue' : ''}`}
                onClick={() => handleTeamChange('B')}
              >
                <span className="pill-dot dot-blue" />
                <span>TIM BIRU</span>
                {team === 'B' && <Check size={14} />}
              </button>
            </div>
          </div>

          {/* Team Name Input */}
          <div className="team-name-row">
            <label className="team-name-label">Nama Tim Anda:</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Contoh: Infection Fighters"
              className="comic-input team-name-input"
              maxLength={30}
              required
            />
          </div>

          {/* SECTION 1: 3 SQUAD SLOTS (INTERACTIVE) */}
          <div className="squad-slots-section">
            <div className="slots-header-tag">
              <span>SUSUNAN 3 HERO TIM ANDA (KLIK SLOT UNTUK MENGGANTI):</span>
            </div>
            <div className="comic-slots-grid">
              {characters.map((slotChar, idx) => {
                const def = CHARACTERS.find((c) => c.id === slotChar.characterId) || CHARACTERS[0];
                const stats = HERO_STATS[def.id] || activeStats;
                const isSelected = selectedSlot === idx;
                return (
                  <div
                    key={idx}
                    className={`comic-slot-card ${isSelected ? 'is-active-slot' : ''}`}
                    onClick={() => {
                      setSelectedSlot(idx);
                      playSound('click');
                    }}
                  >
                    <div className="slot-card-top">
                      <span className="slot-num-badge">SLOT 0{idx + 1}</span>
                      <span className={`slot-status-indicator ${isSelected ? 'active-dot' : ''}`}>
                        {isSelected ? 'EDITING' : 'SIAP ✓'}
                      </span>
                    </div>

                    <div className="slot-card-content">
                      <div className="slot-hero-avatar" style={{ background: def.color }}>
                        <span>{def.name.charAt(0)}</span>
                      </div>
                      <div className="slot-hero-text">
                        <strong className="slot-hero-title">{slotChar.name}</strong>
                        <small className="slot-hero-sub">{def.profession}</small>
                      </div>
                    </div>

                    <div className="slot-power-tag">
                      <Zap size={11} />
                      <span>{stats.pullPower} POWER</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: COMIC HERO ROSTER GALLERY (8 HEROES CARDS) */}
          <div className="comic-roster-section">
            <div className="roster-header">
              <span>KATALOG PAHLAWAN MEDIS (KLIK UNTUK MEMASANG KE SLOT 0{selectedSlot + 1}):</span>
            </div>

            <div className="comic-roster-grid">
              {CHARACTERS.map((c) => {
                const stats = HERO_STATS[c.id] || activeStats;
                const isAssigned = characters.some((slot) => slot.characterId === c.id);
                const isCurrent = activeDef.id === c.id;

                return (
                  <button
                    type="button"
                    key={c.id}
                    className={`comic-hero-card ${isCurrent ? 'is-selected' : ''} ${isAssigned ? 'is-in-team' : ''}`}
                    onClick={() => selectHeroDirectly(c.id)}
                  >
                    <div className="roster-card-avatar" style={{ background: c.color }}>
                      <span>{c.name.charAt(0)}</span>
                      {isCurrent && <span className="roster-check-glow">✓</span>}
                    </div>

                    <div className="roster-card-info">
                      <strong className="roster-hero-name">{c.name}</strong>
                      <span className="roster-hero-prof">{c.profession}</span>
                      <div className="roster-hero-stat">
                        <Zap size={10} /> {stats.pullPower}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ERROR ALERT IF ANY */}
          {error && <div className="comic-error-banner">{error}</div>}

          {/* SECTION 3: BOTTOM CONFIRM ACTION */}
          <div className="comic-action-footer">
            <div className="action-meta-pill">
              <span className="meta-icon">⚡</span>
              <span>
                Slot 0{selectedSlot + 1} Terpilih: <b>{currentSlotChar.name}</b> ({activeDef.profession})
              </span>
            </div>

            <button
              type="button"
              className="comic-confirm-btn"
              disabled={
                busy ||
                !connected ||
                !teamName.trim() ||
                characters.some((c) => !c.name.trim())
              }
              onClick={handleSubmit}
            >
              {busy ? (
                <span>Menyimpan Konfigurasi Tim…</span>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>{isEditMode ? 'SIMPAN PERUBAHAN TIM' : 'CONFIRM SQUAD & READY TO BATTLE'}</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

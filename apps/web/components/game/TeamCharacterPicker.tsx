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
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CHARACTERS,
  type CharacterDefinition,
  type Team,
  type TeamCharacterSlot,
} from '../../../../packages/shared/src';
import CharacterPreview from '../arena/CharacterPreview';
import { isAudioMuted, playSound, setMuted } from '../../lib/audio';

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

  // Active character definition in the carousel
  const currentSlotChar = characters[selectedSlot];
  const initialIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === currentSlotChar.characterId),
  );
  const [carouselIndex, setCarouselIndex] = useState(initialIndex);

  // Sync carousel position when slot changes
  useEffect(() => {
    const slotChar = characters[selectedSlot];
    const idx = CHARACTERS.findIndex((c) => c.id === slotChar.characterId);
    if (idx !== -1) {
      setCarouselIndex(idx);
    }
  }, [selectedSlot]);

  const activeDef: CharacterDefinition = CHARACTERS[carouselIndex] || CHARACTERS[0];
  const prevIndex = (carouselIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
  const nextIndex = (carouselIndex + 1) % CHARACTERS.length;
  const prevDef = CHARACTERS[prevIndex];
  const nextDef = CHARACTERS[nextIndex];

  // Touch swipe support
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

    // Automatically assign the newly browsed hero to the active slot
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
    <div className="kidtopia-viewport">
      {/* BACKGROUND ACCENTS (Cobalt Blue with subtle glowing rings) */}
      <div className="kidtopia-bg-glow glow-1" />
      <div className="kidtopia-bg-glow glow-2" />

      {/* TOP STATUS BAR */}
      <header className="kidtopia-status-bar">
        <div className="kidtopia-avatar-chip">
          <div className={`avatar-circle ${team === 'A' ? 'avatar-green' : 'avatar-blue'}`}>
            <HeartPulse size={16} />
          </div>
          <div className="avatar-chip-text">
            <strong>{team === 'A' ? 'TEAM GREEN' : 'TEAM BLUE'}</strong>
            <small>Pengendali Tim</small>
          </div>
        </div>

        <div className="kidtopia-top-actions">
          <button
            type="button"
            className="kidtopia-icon-pill"
            aria-label={muted ? 'Aktifkan Suara' : 'Matikan Suara'}
            onClick={() => {
              updateMuted(!muted);
              setMuted(!muted);
              if (muted) playSound('ready');
            }}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <div className="kidtopia-coin-pill">
            <span className="coin-dot" />
            <span>ROOM <b>{roomCode}</b></span>
          </div>

          {isEditMode && onCancel && (
            <button
              type="button"
              className="kidtopia-close-pill"
              onClick={onCancel}
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* HERO TITLE & TEAM PICKER */}
      <div className="kidtopia-header-section">
        <h1 className="kidtopia-title">Hand-pick Your Character</h1>
        <p className="kidtopia-subtitle">
          Pilih 3 hero medis terbaik untuk memperkuat barisan tarik tambang tim Anda.
        </p>

        {/* TEAM SELECTOR TABS */}
        <div className="kidtopia-team-toggle">
          <button
            type="button"
            className={`team-toggle-btn ${team === 'A' ? 'active-team-green' : ''}`}
            onClick={() => handleTeamChange('A')}
          >
            <span className="toggle-dot dot-green" />
            <span>TEAM GREEN</span>
            {team === 'A' && <Check size={14} />}
          </button>
          <button
            type="button"
            className={`team-toggle-btn ${team === 'B' ? 'active-team-blue' : ''}`}
            onClick={() => handleTeamChange('B')}
          >
            <span className="toggle-dot dot-blue" />
            <span>TEAM BLUE</span>
            {team === 'B' && <Check size={14} />}
          </button>
        </div>
      </div>

      {/* ORGANIC WHITE BOTTOM SHEET */}
      <section className="kidtopia-sheet">
        {/* EXPLORE HEADER & SLOTS ROW */}
        <div className="kidtopia-sheet-header">
          <div>
            <span className="sheet-eyebrow">CHOOSE 3 HEROES</span>
            <h2 className="sheet-heading">Explore</h2>
          </div>
          <div className="team-name-input-wrap">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nama Tim..."
              className="kidtopia-team-input"
              maxLength={30}
              required
            />
          </div>
        </div>

        {/* 3 HERO SLOTS ROW (CHOOSE 3 HEROES) */}
        <div className="kidtopia-slots-row">
          {characters.map((slotChar, idx) => {
            const def = CHARACTERS.find((c) => c.id === slotChar.characterId) || CHARACTERS[0];
            const isSelected = selectedSlot === idx;
            return (
              <button
                type="button"
                key={idx}
                className={`kidtopia-slot-pill ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSlot(idx);
                  playSound('click');
                }}
              >
                <div className="slot-pill-left">
                  <div className="slot-pill-badge" style={{ background: def.color }}>
                    {def.name.charAt(0)}
                  </div>
                  <div className="slot-pill-text">
                    <span className="slot-label">SLOT 0{idx + 1}</span>
                    <strong className="slot-hero-name">{slotChar.name}</strong>
                  </div>
                </div>
                {isSelected ? (
                  <span className="slot-check-dot active">✓</span>
                ) : (
                  <span className="slot-check-dot">0{idx + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3D CAROUSEL STAGE */}
        <div
          className="kidtopia-carousel-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* LEFT PEEKING CARD */}
          <div
            className="kidtopia-card peeking-card peeking-left"
            onClick={() => slideCarousel(-1)}
            title={`Pilih ${prevDef.name}`}
          >
            <div className="peeking-avatar" style={{ background: prevDef.color }}>
              <span>{prevDef.name.charAt(0)}</span>
            </div>
            <span className="peeking-name">{prevDef.profession}</span>
          </div>

          {/* CENTER HIGHLIGHT CARD (WARM AMBER GRADIENT + 3D CHARACTER) */}
          <div className="kidtopia-card highlight-card">
            {/* Carousel navigation arrows */}
            <button
              type="button"
              className="carousel-arrow arrow-left"
              aria-label="Karakter Sebelumnya"
              onClick={() => slideCarousel(-1)}
            >
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              className="carousel-arrow arrow-right"
              aria-label="Karakter Berikutnya"
              onClick={() => slideCarousel(1)}
            >
              <ChevronRight size={22} />
            </button>

            {/* 3D Character Canvas */}
            <div className="highlight-canvas-wrap">
              <CharacterPreview
                characterId={activeDef.id}
                team={team}
                background="transparent"
              />
            </div>

            {/* Slot indicator tag inside card */}
            <div className="card-floating-badge">
              <span>SLOT 0{selectedSlot + 1}</span>
            </div>
          </div>

          {/* RIGHT PEEKING CARD */}
          <div
            className="kidtopia-card peeking-card peeking-right"
            onClick={() => slideCarousel(1)}
            title={`Pilih ${nextDef.name}`}
          >
            <div className="peeking-avatar" style={{ background: nextDef.color }}>
              <span>{nextDef.name.charAt(0)}</span>
            </div>
            <span className="peeking-name">{nextDef.profession}</span>
          </div>
        </div>

        {/* HERO DETAILS BELOW CARD */}
        <div className="kidtopia-hero-details">
          <div className="hero-name-row">
            {isEditingName ? (
              <div className="name-edit-inline">
                <input
                  type="text"
                  autoFocus
                  value={currentSlotChar.name}
                  onChange={(e) => updateSlotHeroName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingName(false);
                  }}
                  className="name-edit-input"
                  maxLength={25}
                />
                <button
                  type="button"
                  className="name-edit-save"
                  onClick={() => setIsEditingName(false)}
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="hero-name-display" onClick={() => setIsEditingName(true)}>
                <h3 className="hero-name-text">{currentSlotChar.name}</h3>
                <span className="hero-edit-icon" title="Edit nama pahlawan">
                  <Edit2 size={13} />
                </span>
              </div>
            )}
          </div>

          <div className="hero-profession-badge">
            <span className="profession-dot" style={{ background: activeDef.color }} />
            <span>{activeDef.profession}</span>
          </div>

          <p className="hero-description-text">{activeDef.description}</p>
        </div>

        {/* QUICK PROFESSION CHIPS */}
        <div className="kidtopia-quick-gallery">
          <span className="quick-label">Galeri Profesi:</span>
          <div className="quick-chips-row">
            {CHARACTERS.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`quick-chip ${c.id === activeDef.id ? 'active' : ''}`}
                onClick={() => selectHeroDirectly(c.id)}
              >
                <span className="chip-color-dot" style={{ background: c.color }} />
                <span>{c.profession}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ERROR MESSAGE IF ANY */}
        {error && <div className="kidtopia-error-message">{error}</div>}

        {/* FLOATING ACTION PILL & CONFIRM BUTTON */}
        <div className="kidtopia-action-section">
          {/* Slot Pill Badge */}
          <div className="kidtopia-pill-counter">
            <span className="pill-star">⚡</span>
            <span>Slot 0{selectedSlot + 1} Siap: <b>{currentSlotChar.name}</b></span>
          </div>

          <button
            type="button"
            className="kidtopia-confirm-btn"
            disabled={
              busy ||
              !connected ||
              !teamName.trim() ||
              characters.some((c) => !c.name.trim())
            }
            onClick={handleSubmit}
          >
            {busy ? (
              <span>Menyimpan Karakter…</span>
            ) : (
              <>
                <Sparkles size={18} />
                <span>{isEditMode ? 'SIMPAN PERUBAHAN TIM' : 'CONFIRM TEAM & READY'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

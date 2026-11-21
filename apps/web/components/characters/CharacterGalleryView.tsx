'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Heart,
  HeartPulse,
  Lightbulb,
  Pill,
  Rotate3D,
  ShieldPlus,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { CHARACTERS, type CharacterDefinition, type Team } from '../../../../packages/shared/src';
import { playSound } from '../../lib/audio';
import './character-gallery.css';

const CharacterPreview = dynamic(() => import('../arena/CharacterPreview'), {
  ssr: false,
  loading: () => (
    <div className="cg-loading" role="status">
      <span />
      Menyiapkan hero 3D…
    </div>
  ),
});

export interface CharacterGalleryProps {
  selectedId?: string;
  onConfirm?: (id: string) => void | Promise<void>;
  onClose?: () => void;
  team?: Team;
  title?: string;
  backHref?: string;
}

export function ProfessionIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon =
    id === 'midwife'
      ? Heart
      : id === 'pharmacist'
        ? Pill
        : id === 'analyst'
          ? FlaskConical
          : id === 'ambulance'
            ? Truck
            : id === 'radiographer'
              ? Activity
              : id === 'surgeon'
                ? ShieldPlus
                : id.startsWith('nurse')
                  ? HeartPulse
                  : Stethoscope;
  return <Icon size={size} aria-hidden="true" />;
}

const attributes = [
  { key: 'care', label: 'Care', icon: HeartPulse, color: '#34d399' },
  { key: 'teamwork', label: 'Teamwork', icon: Users, color: '#38bdf8' },
  { key: 'knowledge', label: 'Knowledge', icon: Lightbulb, color: '#facc15' },
  { key: 'resilience', label: 'Resilience', icon: Zap, color: '#818cf8' },
] as const;

export default function CharacterGalleryView({
  selectedId = 'doctor-m',
  onConfirm,
  onClose,
  team: initialTeam = 'A',
  title,
  backHref = '/',
}: CharacterGalleryProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(
    CHARACTERS.some((c) => c.id === selectedId) ? selectedId : CHARACTERS[0].id,
  );
  const [team, setTeam] = useState<Team>(initialTeam);
  const [showSlidePopup, setShowSlidePopup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const isModal = Boolean(onClose);

  const heroIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === activeId),
  );
  const hero = CHARACTERS[heroIndex] || CHARACTERS[0];

  useEffect(() => {
    if (!isModal) return;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
    };
  }, [isModal]);

  const choose = useCallback((id: string) => {
    setActiveId(id);
    setCardKey((k) => k + 1);
    playSound('select');
  }, []);

  const handleNext = useCallback(() => {
    const nextIdx = (heroIndex + 1) % CHARACTERS.length;
    choose(CHARACTERS[nextIdx].id);
  }, [choose, heroIndex]);

  const handlePrev = useCallback(() => {
    const prevIdx = (heroIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
    choose(CHARACTERS[prevIdx].id);
  }, [choose, heroIndex]);

  // Keyboard navigation: Left/Right switches hero, Enter opens slide pop-up, Escape closes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showSlidePopup) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowSlidePopup(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleContinueGame();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmSelect();
      } else if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev, onClose, showSlidePopup]);

  function handleConfirmSelect() {
    playSound('ready');
    try {
      localStorage.setItem('medical:preferredHero', hero.id);
      localStorage.setItem('medical:preferredTeam', team);
    } catch {
      /* ignore if disabled */
    }
    // Trigger signature pop up slide animation!
    setShowSlidePopup(true);
  }

  async function handleContinueGame() {
    setBusy(true);
    try {
      if (onConfirm) {
        await onConfirm(hero.id);
        if (onClose) onClose();
      } else {
        router.push('/play');
      }
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div
      className="cg-cinematic-shell"
      style={
        {
          '--hero-accent': hero.accent || '#e11d62',
        } as CSSProperties
      }
    >
      {/* 1. SIGNATURE CINEMATIC DIAGONAL SPLIT WEDGE (BIG HERO 6 STYLE) */}
      <div className="cg-diagonal-wedge" aria-hidden="true" />
      <div className="cg-cyber-grid" aria-hidden="true" />
      <div className="cg-particles-drift" aria-hidden="true" />

      {/* 2. TOP HEADER HUD */}
      <header className="cg-top-hud">
        <Link href={backHref} className="cg-brand-pill" aria-label="Beranda Medical Tug of War">
          <div className="cg-brand-icon">
            <Activity size={20} />
          </div>
          <div className="cg-brand-info">
            <span className="cg-brand-title">MEDICAL TUG OF WAR</span>
            <span className="cg-brand-sub">RSUD AL-MULK • HERO SHOWCASE</span>
          </div>
        </Link>

        <div className="cg-header-actions">
          <span className="cg-hud-tag">
            <span className="cg-live-dot" />
            HERO GALLERY ARCHIVE
          </span>
          {onClose ? (
            <button
              type="button"
              className="cg-back-btn"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup galeri"
            >
              <X size={16} />
              Tutup
            </button>
          ) : (
            <Link className="cg-back-btn" href={backHref}>
              <ArrowLeft size={16} />
              Kembali
            </Link>
          )}
        </div>
      </header>

      {/* 3. MAIN STAGE LAYOUT (LEFT: 3D HERO + HUD RETICLES, RIGHT: CHARACTER DOSSIER) */}
      <main className="cg-showcase-grid">
        {/* LEFT COLUMN: 3D CHARACTER WITH SCI-FI / MEDICAL TECH RETICLES */}
        <section className="cg-hero-display" aria-label="Tampilan 3D Karakter">
          {/* Tech Reticles & Telemetry Points (Big Hero 6 style) */}
          <div className="cg-reticles-overlay" aria-hidden="true">
            {/* Chest / Pulse Telemetry Point */}
            <div className="cg-hud-point is-chest">
              <span className="cg-target-ring" />
              <span className="cg-hud-line" />
              <div className="cg-hud-data">
                <b>PULSE TELEMETRY</b>
                <span>ECG 78 BPM • SYNC READY</span>
              </div>
            </div>

            {/* Specialty / ID Badge Point */}
            <div className="cg-hud-point is-badge">
              <span className="cg-target-ring" />
              <span className="cg-hud-line" />
              <div className="cg-hud-data">
                <b>SPECIALTY PROTOCOL</b>
                <span>{hero.profession.toUpperCase()}</span>
              </div>
            </div>

            {/* Orbiting concentric background rings */}
            <div className="cg-orbit-pulse" />
          </div>

          {/* 3D Character Canvas */}
          <div className="cg-model-wrapper" key={hero.id}>
            <CharacterPreview
              characterId={hero.id}
              team={team}
              background="transparent"
              selected
              showHint={false}
            />
          </div>

          {/* Stage Bottom Indicator */}
          <div className="cg-hero-meta-badge">
            <div className="cg-hero-index-num">
              <span>{String(heroIndex + 1).padStart(2, '0')}</span>
              <small>/ {String(CHARACTERS.length).padStart(2, '0')}</small>
            </div>
            <div className="cg-hero-rotation-hint">
              <strong>{hero.name}</strong>
              <span>
                <Rotate3D size={15} /> Geser untuk memutar hero 360°
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: HERO DOSSIER & PROFILE (SLIDES SMOOTHLY ON SELECTION) */}
        <section className="cg-hero-dossier" key={`dossier-${cardKey}`}>
          <div className="cg-dossier-header">
            <div className="cg-dossier-pill">
              <Sparkles size={14} />
              MEDICAL HERO // RSUD AL-MULK
            </div>
            <span className="cg-hero-code">HERO-{String(heroIndex + 1).padStart(3, '0')}</span>
          </div>

          <div className="cg-dossier-main">
            <h1 className="cg-dossier-name">{hero.title}</h1>
            <div className="cg-dossier-profession-row">
              <span className="cg-dossier-profession">
                <ProfessionIcon id={hero.id} size={18} />
                {hero.profession}
              </span>
              <span className="cg-dossier-team-badge">
                {team === 'A' ? 'TIM HIJAU' : 'TIM BIRU'}
              </span>
            </div>

            <div className="cg-dossier-bio-wrap">
              <p className="cg-dossier-bio">{hero.description}</p>
              <div className="cg-bio-tech-line" aria-hidden="true">
                <span className="cg-tech-notch" />
              </div>
            </div>

            {/* ATTRIBUTE BARS (FUTURISTIC MEDICAL TELEMETRY GAUGES) */}
            <div className="cg-stats-cluster">
              {attributes.map((attr) => (
                <div className="cg-stat-row" key={attr.key}>
                  <div className="cg-stat-label">
                    <attr.icon size={15} style={{ color: attr.color }} />
                    <span>{attr.label}</span>
                  </div>
                  <div
                    className="cg-stat-bar-track"
                    role="progressbar"
                    aria-label={attr.label}
                    aria-valuenow={hero.attributes[attr.key]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="cg-stat-bar-fill"
                      style={{
                        width: `${hero.attributes[attr.key]}%`,
                        background: attr.color,
                        boxShadow: `0 0 10px ${attr.color}80`,
                      }}
                    />
                  </div>
                  <strong className="cg-stat-val">{hero.attributes[attr.key]}</strong>
                </div>
              ))}
            </div>

            {/* PRIMARY CALL TO ACTION BUTTON */}
            <div className="cg-action-row">
              <button
                type="button"
                className="cg-primary-select-btn"
                onClick={handleConfirmSelect}
              >
                <span>PILIH KARAKTER</span>
                <div className="cg-btn-arrow">
                  <ArrowRight size={18} />
                </div>
              </button>

              {/* Team color preview toggle */}
              <div className="cg-team-toggle-group">
                <button
                  type="button"
                  className={`cg-team-btn is-green ${team === 'A' ? 'is-selected' : ''}`}
                  onClick={() => {
                    setTeam('A');
                    playSound('select');
                  }}
                  title="Pratinjau Tim Hijau"
                >
                  <i /> Tim Hijau
                </button>
                <button
                  type="button"
                  className={`cg-team-btn is-blue ${team === 'B' ? 'is-selected' : ''}`}
                  onClick={() => {
                    setTeam('B');
                    playSound('select');
                  }}
                  title="Pratinjau Tim Biru"
                >
                  <i /> Tim Biru
                </button>
              </div>
            </div>
          </div>

          {/* 4. BOTTOM HORIZONTAL CIRCULAR AVATAR SELECTOR (BIG HERO 6 STYLE) */}
          <div className="cg-bottom-avatar-row" aria-label="Pilih Karakter Lainnya">
            <button
              type="button"
              className="cg-avatar-nav-btn"
              onClick={handlePrev}
              aria-label="Karakter sebelumnya"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="cg-avatar-list">
              {CHARACTERS.map((c, idx) => {
                const isActive = c.id === hero.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cg-avatar-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => choose(c.id)}
                    aria-label={`Pilih ${c.name}`}
                    title={c.name}
                  >
                    {/* Concentric pulsing target ring on active hero */}
                    {isActive && (
                      <span className="cg-avatar-target-ring" aria-hidden="true">
                        <span className="cg-ring-bracket is-left" />
                        <span className="cg-ring-bracket is-right" />
                      </span>
                    )}
                    <img
                      src={c.thumbnailPath}
                      alt={c.name}
                      className="cg-avatar-img"
                      draggable={false}
                    />
                    <span className="cg-avatar-num">{String(idx + 1).padStart(2, '0')}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="cg-avatar-nav-btn"
              onClick={handleNext}
              aria-label="Karakter berikutnya"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>
      </main>

      {/* ========================================================================
          5. ANIMATED POP-UP SLIDE CONFIRMATION (WHEN HERO IS SELECTED)
          ======================================================================== */}
      {showSlidePopup && (
        <div
          className="cg-slide-popup-backdrop"
          onClick={() => setShowSlidePopup(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Pilihan Hero"
        >
          <div
            className="cg-slide-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              className="cg-popup-close-btn"
              onClick={() => setShowSlidePopup(false)}
              aria-label="Tutup"
            >
              <X size={20} />
            </button>

            {/* Header Badge */}
            <div className="cg-popup-badge">
              <Check size={18} strokeWidth={3} />
              <span>HERO BERHASIL DIPILIH!</span>
            </div>

            {/* Hero Card Visual */}
            <div className="cg-popup-hero-preview">
              <div className="cg-popup-avatar-frame">
                <img
                  src={hero.thumbnailPath}
                  alt={hero.name}
                  className="cg-popup-avatar"
                  draggable={false}
                />
                <span className="cg-popup-glow-ring" />
              </div>

              <div className="cg-popup-hero-titles">
                <span className="cg-popup-role-tag">{hero.profession.toUpperCase()}</span>
                <h2 className="cg-popup-hero-name">{hero.name}</h2>
                <span className="cg-popup-title-tag">
                  {hero.title} • RSUD AL-MULK
                </span>
              </div>
            </div>

            {/* Team Assignment Selector */}
            <div className="cg-popup-team-picker">
              <span className="cg-team-picker-label">PILIHAN TIM:</span>
              <div className="cg-team-picker-pills">
                <button
                  type="button"
                  className={`cg-team-pill is-green ${team === 'A' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTeam('A');
                    playSound('select');
                  }}
                >
                  <i /> TIM HIJAU
                </button>
                <button
                  type="button"
                  className={`cg-team-pill is-blue ${team === 'B' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTeam('B');
                    playSound('select');
                  }}
                >
                  <i /> TIM BIRU
                </button>
              </div>
            </div>

            {/* Short Stats Radar Summary */}
            <div className="cg-popup-stats-summary">
              <div className="cg-popup-stat">
                <span className="label">Care</span>
                <span className="val" style={{ color: '#34d399' }}>{hero.attributes.care}</span>
              </div>
              <div className="cg-popup-stat">
                <span className="label">Teamwork</span>
                <span className="val" style={{ color: '#38bdf8' }}>{hero.attributes.teamwork}</span>
              </div>
              <div className="cg-popup-stat">
                <span className="label">Knowledge</span>
                <span className="val" style={{ color: '#facc15' }}>{hero.attributes.knowledge}</span>
              </div>
              <div className="cg-popup-stat">
                <span className="label">Resilience</span>
                <span className="val" style={{ color: '#818cf8' }}>{hero.attributes.resilience}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="cg-popup-actions">
              <button
                type="button"
                className="cg-popup-confirm-btn"
                onClick={handleContinueGame}
                disabled={busy}
              >
                <span>{busy ? 'MENYIAPKAN…' : 'LANJUT KE ARENA'}</span>
                <ArrowRight size={20} />
              </button>

              <button
                type="button"
                className="cg-popup-cancel-btn"
                onClick={() => setShowSlidePopup(false)}
              >
                GANTI KARAKTER LAIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return onClose ? (
    <dialog
      ref={dialog}
      className="cg-dialog"
      aria-label={title || 'Pilih karakter'}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {content}
    </dialog>
  ) : (
    content
  );
}

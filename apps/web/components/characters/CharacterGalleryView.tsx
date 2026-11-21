'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Gamepad2,
  Heart,
  HeartPulse,
  Pill,
  RotateCw,
  ShieldPlus,
  Stethoscope,
  Truck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { CHARACTERS, type Team } from '../../../../packages/shared/src';
import { playSound } from '../../lib/audio';
import './character-gallery.css';

export interface CharacterGalleryProps {
  selectedId?: string;
  onConfirm?: (id: string) => void | Promise<void>;
  onClose?: () => void;
  team?: Team;
  title?: string;
  backHref?: string;
}

export function ProfessionIcon({ id, size = 22 }: { id: string; size?: number }) {
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
  return <Icon size={size} strokeWidth={2.3} aria-hidden="true" />;
}

const attributes = [
  {
    key: 'care',
    label: 'Care',
    icon: Heart,
    color: '#10b981',
    gradient: 'linear-gradient(180deg, #6ee7b7 0%, #10b981 55%, #059669 100%)',
    iconColor: '#ff2e93',
    strokeColor: '#ff7eb6',
  },
  {
    key: 'teamwork',
    label: 'Teamwork',
    icon: Users,
    color: '#38bdf8',
    gradient: 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 55%, #0284c7 100%)',
    iconColor: '#38f6ff',
    strokeColor: '#0c4a6e',
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    color: '#facc15',
    gradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 55%, #ca8a04 100%)',
    iconColor: '#facc15',
    strokeColor: '#78350f',
  },
  {
    key: 'resilience',
    label: 'Resilience',
    icon: Zap,
    color: '#a855f7',
    gradient: 'linear-gradient(180deg, #e9d5ff 0%, #c084fc 50%, #9333ea 100%)',
    iconColor: '#c084fc',
    strokeColor: '#e9d5ff',
  },
] as const;

const VISIBLE_CARDS = 5;

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
  const [turntableAngle, setTurntableAngle] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragBaseAngle = useRef<number>(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const isModal = Boolean(onClose);

  const heroIndex = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === activeId),
  );
  const hero = CHARACTERS[heroIndex] || CHARACTERS[0];

  // Keep a clean 5-card window so 5 complete portrait cards (e.g. 01..05) are always shown without clipping
  const windowStart = Math.min(
    Math.max(0, heroIndex - 2),
    Math.max(0, CHARACTERS.length - VISIBLE_CARDS),
  );
  const visibleCharacters = CHARACTERS.slice(windowStart, windowStart + VISIBLE_CARDS);

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
    setTurntableAngle(0);
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

  // Interactive 360 turntable drag on character stage
  const handleStagePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
    dragBaseAngle.current = turntableAngle;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const deltaX = e.clientX - dragStartX.current;
    setTurntableAngle(dragBaseAngle.current + deltaX * 0.85);
  };

  const handleStagePointerUp = () => {
    dragStartX.current = null;
  };

  const handleSpin360 = () => {
    playSound('select');
    setTurntableAngle((prev) => prev + 360);
  };

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
          '--hero-accent': hero.accent || '#38bdf8',
        } as CSSProperties
      }
    >
      {/* 1. EXACT GOLDEN-HOUR RSUD AL-MULK HOSPITAL COURTYARD & HOLOGRAPHIC PODIUM BACKGROUND */}
      <div className="cg-bg-stage" aria-hidden="true">
        <img
          src="/images/gallery-hospital-bg.jpg"
          alt=""
          className="cg-bg-img"
          draggable={false}
        />
        <div className="cg-bg-overlay" />
      </div>

      {/* 2. TOP HEADER HUD MATCHING REFERENCE IMAGE */}
      <header className="cg-top-hud">
        <Link href={backHref} className="cg-logo-lockup" aria-label="Beranda Medical Tug of War">
          <div className="cg-logo-crest" aria-hidden="true">
            <Gamepad2 size={32} strokeWidth={2.4} className="cg-crest-gamepad" />
            <Activity size={24} strokeWidth={3} className="cg-crest-ecg" />
          </div>
          <div className="cg-logo-texts">
            <span className="cg-logo-main">MEDICAL</span>
            <div className="cg-logo-sub-wrap">
              <span className="cg-logo-sub">TUG OF WAR</span>
            </div>
            <span className="cg-logo-tag">RSUD AL-MULK • QUIZ BATTLE</span>
          </div>
        </Link>

        <div className="cg-header-actions">
          <span className="cg-hud-tag">
            <span className="cg-live-dot" />
            HERO GALLERY ARCHIVE
          </span>
          <span className="cg-header-divider" aria-hidden="true" />
          {onClose ? (
            <button
              type="button"
              className="cg-back-btn"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup galeri"
            >
              <X size={17} strokeWidth={2.6} />
              Tutup
            </button>
          ) : (
            <Link className="cg-back-btn" href={backHref}>
              <ArrowLeft size={17} strokeWidth={2.6} />
              Kembali
            </Link>
          )}
        </div>
      </header>

      {/* 3. LEFT STAGE: FULL-BODY CHARACTER LOCKED ON THE HOLOGRAPHIC PODIUM + TELEMETRY CALLOUTS */}
      <section className="cg-left-stage" aria-label="Tampilan Ilustrasi Karakter">
        {/* Pulse Telemetry Hexagonal Callout */}
        <div className="cg-hud-point is-chest" aria-hidden="true">
          <div className="cg-hud-callout">
            <HeartPulse size={34} strokeWidth={2.1} className="cg-hud-raw-icon" />
            <div className="cg-hud-data">
              <b>PULSE TELEMETRY</b>
              <span>ECG 78 BPM - SYNC READY</span>
            </div>
          </div>
          <span className="cg-hud-connector is-angled">
            <i className="cg-origin-node" />
            <i className="cg-target-node" />
          </span>
        </div>

        {/* Specialty Protocol Hexagonal Callout */}
        <div className="cg-hud-point is-badge" aria-hidden="true">
          <div className="cg-hud-callout">
            <ShieldPlus size={34} strokeWidth={2.1} className="cg-hud-raw-icon" />
            <div className="cg-hud-data">
              <b>SPECIALTY PROTOCOL</b>
              <span>{hero.profession.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Full-Body Character Standing on the Holographic Pedestal */}
        <div
          className="cg-hero-stage-center"
          key={hero.id}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          title="Geser untuk memutar hero 360°"
        >
          <div
            className="cg-hero-art-frame"
            style={{
              transform: `perspective(1100px) rotateY(${turntableAngle}deg)`,
            }}
          >
            <img
              src={hero.fullBodyImagePath || hero.poseImagePath || hero.thumbnailPath}
              alt={hero.name}
              className="cg-hero-pose-img"
              draggable={false}
            />
          </div>

          {/* Grounded Dual-Shoe Contact Shadow + Cyan Holographic Ring Reflection */}
          <div className="cg-shoe-contact-shadows" aria-hidden="true">
            <span className="cg-shoe-shadow is-left" />
            <span className="cg-shoe-shadow is-right" />
          </div>
          <div className="cg-podium-foot-glow" aria-hidden="true" />
        </div>

        {/* Bottom-Left Slanted Glass Hero Index Badge */}
        <button
          type="button"
          className="cg-hero-meta-badge"
          onClick={handleSpin360}
          aria-label={`${hero.name} - Putar hero 360 derajat`}
        >
          <div className="cg-meta-inner">
            <div className="cg-hero-index-num">
              <span>{String(heroIndex + 1).padStart(2, '0')}</span>
              <small>/{String(CHARACTERS.length).padStart(2, '0')}</small>
            </div>
            <span className="cg-meta-divider" aria-hidden="true" />
            <div className="cg-hero-rotation-hint">
              <strong>{hero.name}</strong>
              <span>
                <RotateCw size={14} strokeWidth={2.5} /> Geser untuk memutar hero 360°
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* 4. RIGHT STAGE: HERO DOSSIER, ATTRIBUTE BARS, ACTIONS & 5-CARD PORTRAIT CAROUSEL */}
      <section className="cg-hero-dossier" key={`dossier-${cardKey}`} aria-label="Profil Karakter">
        <div className="cg-dossier-header">
          <div className="cg-dossier-pill">
            <Activity size={17} strokeWidth={2.6} />
            <span>MEDICAL HERO // RSUD AL-MULK</span>
          </div>
          <div className="cg-hero-code">
            <span>HERO-{String(heroIndex + 1).padStart(3, '0')}</span>
          </div>
        </div>

        <div className="cg-dossier-main">
          <div className="cg-dossier-title-row">
            <h1 className="cg-dossier-name" data-text={hero.title}>
              {hero.title}
            </h1>
            <span className="cg-title-flare" aria-hidden="true" />
          </div>

          <div className="cg-dossier-profession-row">
            <span className="cg-dossier-profession">
              <ProfessionIcon id={hero.id} size={22} />
              {hero.profession}
            </span>
            <span className={`cg-dossier-team-badge ${team === 'A' ? 'is-green' : 'is-blue'}`}>
              {team === 'A' ? 'Tim Hijau' : 'Tim Biru'}
            </span>
          </div>

          <p className="cg-dossier-bio">{hero.description}</p>

          {/* ATTRIBUTE BARS (CHAMFERED HOLOGRAPHIC GLASS PANEL) */}
          <div className="cg-stats-cluster">
            {attributes.map((attr) => (
              <div className="cg-stat-row" key={attr.key}>
                <div className="cg-stat-label">
                  <attr.icon
                    size={20}
                    fill={attr.iconColor}
                    color={attr.strokeColor}
                    strokeWidth={1.8}
                    className="cg-stat-solid-icon"
                    style={{ filter: `drop-shadow(0 0 7px ${attr.iconColor})` }}
                  />
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
                      background: attr.gradient,
                      boxShadow: `0 0 14px ${attr.color}b0`,
                    }}
                  />
                </div>
                <strong className="cg-stat-val">{hero.attributes[attr.key]}</strong>
              </div>
            ))}
          </div>

          {/* PRIMARY CALL TO ACTION BUTTON + TEAM PILLS */}
          <div className="cg-action-row">
            <button
              type="button"
              className="cg-primary-select-btn"
              onClick={handleConfirmSelect}
            >
              <span>PILIH KARAKTER</span>
              <div className="cg-btn-arrow">
                <ArrowRight size={18} strokeWidth={3} />
              </div>
            </button>

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

        {/* 5. BOTTOM 5-CARD ROUNDED-SQUARE PORTRAIT CAROUSEL WITH PENTAGONAL CHEVRON SHIELDS */}
        <div className="cg-bottom-avatar-row" aria-label="Pilih Karakter Lainnya">
          <button
            type="button"
            className="cg-avatar-nav-btn is-prev"
            onClick={handlePrev}
            aria-label="Karakter sebelumnya"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>

          <div className="cg-avatar-list">
            {visibleCharacters.map((c) => {
              const globalIdx = CHARACTERS.findIndex((item) => item.id === c.id);
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
                  <img
                    src={c.poseImagePath || c.thumbnailPath}
                    alt={c.name}
                    className="cg-avatar-img"
                    draggable={false}
                  />
                  <span className="cg-avatar-num">{String(globalIdx + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="cg-avatar-nav-btn is-next"
            onClick={handleNext}
            aria-label="Karakter berikutnya"
          >
            <ChevronRight size={28} strokeWidth={3} />
          </button>
        </div>
      </section>

      {/* ========================================================================
          6. ANIMATED POP-UP SLIDE CONFIRMATION (WHEN HERO IS SELECTED)
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
            <button
              type="button"
              className="cg-popup-close-btn"
              onClick={() => setShowSlidePopup(false)}
              aria-label="Tutup"
            >
              <X size={20} />
            </button>

            <div className="cg-popup-badge">
              <Check size={18} strokeWidth={3} />
              <span>HERO BERHASIL DIPILIH!</span>
            </div>

            <div className="cg-popup-hero-preview">
              <div className="cg-popup-avatar-frame">
                <img
                  src={hero.poseImagePath || hero.thumbnailPath}
                  alt={hero.name}
                  className="cg-popup-avatar"
                  draggable={false}
                />
              </div>

              <div className="cg-popup-hero-titles">
                <span className="cg-popup-role-tag">{hero.profession.toUpperCase()}</span>
                <h2 className="cg-popup-hero-name">{hero.name}</h2>
                <span className="cg-popup-title-tag">
                  {hero.title} • RSUD AL-MULK
                </span>
              </div>
            </div>

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
                <span className="val" style={{ color: '#c084fc' }}>{hero.attributes.resilience}</span>
              </div>
            </div>

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

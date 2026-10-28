'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Cross,
  FlaskConical,
  Heart,
  HeartPulse,
  Lightbulb,
  Pill,
  Rotate3D,
  ShieldPlus,
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
      Menyiapkan hero…
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

export function ProfessionIcon({ id, size = 24 }: { id: string; size?: number }) {
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
// Put six different professions on the first spread, then preserve registry order.
const firstSpread = ['doctor-m', 'nurse-f', 'midwife', 'pharmacist', 'analyst', 'ambulance'];
const heroes = [
  ...firstSpread.map((id) => CHARACTERS.find((c) => c.id === id)!).filter(Boolean),
  ...CHARACTERS.filter((c) => !firstSpread.includes(c.id)),
];

function PortraitCard({
  hero,
  selected,
  onSelect,
}: {
  hero: CharacterDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`cg-hero-card ${selected ? 'is-selected' : ''}`}
      style={{ '--hero-accent': hero.accent } as CSSProperties}
      onClick={onSelect}
      aria-label={`${hero.name}, ${hero.profession}`}
      aria-pressed={selected}
    >
      <span className="cg-card-backdrop" aria-hidden="true">
        <Cross />
      </span>
      <img src={hero.thumbnailPath} alt="" width={360} height={440} draggable={false} />
      <span className="cg-card-caption">
        <span className="cg-profession-icon">
          <ProfessionIcon id={hero.id} size={25} />
        </span>
        <span>
          <strong>{hero.title}</strong>
          <small>{hero.name}</small>
        </span>
      </span>
      {selected && (
        <span className="cg-card-check">
          <Check size={14} />
          <span className="cg-sr-only">Dipilih</span>
        </span>
      )}
    </button>
  );
}

export default function CharacterGalleryView({
  selectedId = 'doctor-m',
  onConfirm,
  onClose,
  team: initialTeam = 'A',
  title,
  backHref = '/',
}: CharacterGalleryProps) {
  const [activeId, setActiveId] = useState(
    CHARACTERS.some((c) => c.id === selectedId) ? selectedId : CHARACTERS[0].id,
  );
  const [page, setPage] = useState(
    Math.floor(
      Math.max(
        0,
        heroes.findIndex((c) => c.id === selectedId),
      ) / 6,
    ),
  );
  const [team, setTeam] = useState<Team>(initialTeam);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const isModal = Boolean(onClose);
  const hero = CHARACTERS.find((c) => c.id === activeId) || CHARACTERS[0];
  const pageCount = Math.ceil(heroes.length / 6);

  useEffect(() => {
    if (!isModal) return;
    const node = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, [isModal]);

  function choose(id: string) {
    if (busy) return;
    setActiveId(id);
    setConfirmed(false);
    setError('');
    playSound('select');
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      if (onConfirm) await onConfirm(hero.id);
      else {
        try {
          localStorage.setItem('medical:preferredHero', hero.id);
        } catch {
          /* Browsing remains available with storage disabled. */
        }
        setConfirmed(true);
      }
      playSound('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Karakter belum tersimpan. Coba kembali.');
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <section
      className="cg-shell"
      style={{ '--active-accent': hero.accent } as CSSProperties}
      aria-label="Galeri karakter"
    >
      <header className="cg-header">
        <Link href="/" className="cg-brand" aria-label="Medical Tug of War beranda">
          <Activity size={44} />
          <span>
            MEDICAL
            <br />
            TUG OF WAR<small>Healthcare Heroes Quiz Battle</small>
          </span>
        </Link>
        <div className="cg-header-right">
          <span className="cg-edition">
            <span />
            HEALTHCARE HEROES COLLECTION
          </span>
          {onClose ? (
            <button
              type="button"
              className="cg-back"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup galeri"
            >
              <X size={18} />
              Kembali ke tim
            </button>
          ) : (
            <Link className="cg-back" href={backHref}>
              <ArrowLeft size={17} />
              Kembali
            </Link>
          )}
        </div>
      </header>
      <div className="cg-layout">
        <div className="cg-stage">
          <div className="cg-stage-scene" aria-hidden="true">
            <span className="cg-hospital">
              <i />
              <i />
              <i />
              <b>+</b>
            </span>
            <span className="cg-orbit cg-orbit-one" />
            <span className="cg-orbit cg-orbit-two" />
            <Cross className="cg-float cg-float-one" />
            <Cross className="cg-float cg-float-two" />
            <span className="cg-stage-lines" />
          </div>
          <span className="cg-stage-label">
            <span />
            LIVE HERO PREVIEW
          </span>
          <div className="cg-model" data-hero={hero.id}>
            <CharacterPreview
              characterId={hero.id}
              team={team}
              background="transparent"
              selected
              showHint={false}
            />
          </div>
          <div className="cg-stage-footer">
            <span className="cg-hero-number">
              {String(heroes.findIndex((c) => c.id === hero.id) + 1).padStart(2, '0')}
              <small>/ {CHARACTERS.length}</small>
            </span>
            <div>
              <strong>{hero.name}</strong>
              <span>
                <Rotate3D size={16} />
                Geser untuk memutar hero
              </span>
            </div>
          </div>
        </div>
        <div className="cg-heading">
          <span className="cg-kicker">{title || 'TEMUKAN PAHLAWAN DALAM DIRIMU'}</span>
          <h1>
            CHARACTER <em>GALLERY</em>
          </h1>
          <p>
            Choose Your Healthcare Hero <Activity size={45} />
          </p>
        </div>
        <section className="cg-info" aria-live="polite" aria-atomic="true">
          <div className="cg-info-top">
            <span className="cg-role-tag">
              <Cross size={16} />
              MEDICAL HERO
            </span>
            <span className="cg-info-index">
              {String(heroes.findIndex((c) => c.id === hero.id) + 1).padStart(2, '0')}
            </span>
          </div>
          <div className="cg-description" key={hero.id}>
            <h2>{hero.title}</h2>
            <p className="cg-profession">
              {hero.profession}
              <Activity size={37} />
            </p>
            <p className="cg-tagline">
              Care <i /> Support <i /> Make a Difference
            </p>
            <p className="cg-bio">{hero.description}</p>
          </div>
          <div className="cg-attributes">
            {attributes.map((attr) => (
              <div className="cg-attribute" key={attr.key}>
                <attr.icon size={20} />
                <div>
                  <span>{attr.label}</span>
                  <div
                    role="progressbar"
                    aria-label={attr.label}
                    aria-valuenow={hero.attributes[attr.key]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="cg-track"
                  >
                    <i style={{ width: `${hero.attributes[attr.key]}%`, background: attr.color }} />
                  </div>
                </div>
                <strong>{hero.attributes[attr.key]}</strong>
              </div>
            ))}
          </div>
          <p className="cg-stat-note">Profil hero · skor ditentukan oleh jawaban tim.</p>
          {error && (
            <p className="cg-error" role="alert">
              {error}
            </p>
          )}
          <button className="cg-confirm" type="button" onClick={confirm} disabled={busy}>
            {busy ? 'MENYIMPAN…' : confirmed ? 'HERO TERPILIH' : 'PILIH KARAKTER'}
            <span>{confirmed ? <Check size={22} /> : <ArrowRight size={22} />}</span>
          </button>
          {confirmed && !onConfirm && (
            <div className="cg-confirmed" role="status">
              {hero.name} siap menemani timmu.
              <Link href="/join">
                Gabung pertandingan <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {!onConfirm && (
            <div className="cg-team-colors" aria-label="Warna tim preview">
              <span>Warna tim</span>
              <button type="button" onClick={() => setTeam('A')} aria-pressed={team === 'A'}>
                <i className="cg-green" />
                Green
              </button>
              <button type="button" onClick={() => setTeam('B')} aria-pressed={team === 'B'}>
                <i className="cg-blue" />
                Blue
              </button>
            </div>
          )}
        </section>
        <section className="cg-roster" aria-label="Daftar karakter">
          <div className="cg-grid">
            {heroes.slice(page * 6, page * 6 + 6).map((c) => (
              <PortraitCard
                key={c.id}
                hero={c}
                selected={hero.id === c.id}
                onSelect={() => choose(c.id)}
              />
            ))}
          </div>
          <nav className="cg-pagination" aria-label="Halaman karakter">
            <span>
              {heroes.length} HERO <i /> SATU SEMANGAT
            </span>
            <div>
              <button
                type="button"
                aria-label="Halaman karakter sebelumnya"
                disabled={page === 0 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Halaman karakter berikutnya"
                disabled={page === pageCount - 1 || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </nav>
        </section>
      </div>
      <footer className="cg-footer">
        <span>
          <ShieldPlus size={15} />
          PENGETAHUAN. KEPEDULIAN. KERJA SAMA.
        </span>
        <span>
          2 TIM <i /> 6 HERO <i /> 1 TUJUAN
        </span>
      </footer>
    </section>
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

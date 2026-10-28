'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Edit2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CHARACTERS,
  defaultTeamCharacters,
  type RoomState,
  type Team,
  type TeamCharacterSlot,
} from '../../../../packages/shared/src';
import CharacterGalleryView from '../characters/CharacterGalleryView';
import { playSound } from '../../lib/audio';
import './team-selection.css';

type Slots = [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
export interface TeamUpdate {
  teamName?: string;
  characters?: Slots;
  characterNames?: { slot: number; name: string }[];
}
export interface TeamCharacterPickerProps {
  initialTeam?: Team;
  initialTeamName?: string;
  initialCharacters?: Slots;
  teams?: RoomState['teams'];
  roomCode: string;
  roomTitle?: string;
  packageName?: string;
  busy?: boolean;
  connected?: boolean;
  error?: string;
  isEditMode?: boolean;
  lockCharacters?: boolean;
  ready?: boolean;
  onTeamChange?: (team: Team) => void;
  onUpdate?: (patch: TeamUpdate) => Promise<void>;
  onReady?: () => Promise<void> | void;
  onConfirm: (data: { team: Team; teamName: string; characters: Slots }) => Promise<void> | void;
  onCancel?: () => void;
}

function NameEditor({
  value,
  label,
  maxLength,
  disabled,
  onSave,
  children,
}: {
  value: string;
  label: string;
  maxLength: number;
  disabled?: boolean;
  onSave: (value: string) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  if (!editing)
    return (
      <div className="ts-name-row">
        <strong title={value}>{value}</strong>
        {!disabled && (
          <button
            type="button"
            className="ts-icon-button"
            aria-label={label}
            onClick={() => {
              setDraft(value);
              setMessage('');
              setEditing(true);
            }}
          >
            <Edit2 size={14} />
          </button>
        )}
        {children}
      </div>
    );
  return (
    <form
      className="ts-name-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.trim()) {
          setMessage('Nama wajib diisi.');
          return;
        }
        setSaving(true);
        setMessage('');
        try {
          await onSave(draft.trim());
          setEditing(false);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Nama belum tersimpan.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        <span className="ts-sr-only">{label}</span>
        <input
          autoFocus
          aria-label={label}
          value={draft}
          maxLength={maxLength}
          disabled={saving || disabled}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !saving) {
              e.stopPropagation();
              setEditing(false);
            }
          }}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="ts-edit-actions">
        <button type="submit" disabled={saving || disabled || !draft.trim()}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button type="button" disabled={saving} onClick={() => setEditing(false)}>
          Batal
        </button>
      </div>
      {message && <small role="alert">{message}</small>}
    </form>
  );
}

export function TeamSelectionDialog({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    const focused = document.activeElement as HTMLElement | null;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = previous;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export default function TeamCharacterPicker({
  initialTeam = 'A',
  initialTeamName,
  initialCharacters,
  teams,
  roomCode,
  roomTitle,
  packageName,
  busy = false,
  connected = true,
  error,
  isEditMode = false,
  lockCharacters = false,
  ready = false,
  onTeamChange,
  onUpdate,
  onReady,
  onConfirm,
  onCancel,
}: TeamCharacterPickerProps) {
  const [team, setTeam] = useState<Team>(initialTeam);
  const [teamName, setTeamName] = useState(initialTeamName || 'Tim Hijau');
  const [characters, setCharacters] = useState<Slots>(
    initialCharacters || defaultTeamCharacters(initialTeam),
  );
  const [activeSlot, setActiveSlot] = useState(0);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const strip = useRef<HTMLDivElement>(null);
  const pending = busy || saving;
  const ownCharacters = onUpdate && teams ? teams[team].characters : characters;
  const editable = isEditMode || !teams?.[team].connected;
  const ownName = onUpdate && teams ? teams[team].name : teamName;
  const active = ownCharacters[activeSlot];
  const activeDef =
    CHARACTERS.find((c) => c.id === (candidate || active.characterId)) || CHARACTERS[0];

  useEffect(() => {
    setTeam(initialTeam);
    setTeamName(initialTeamName || (initialTeam === 'A' ? 'Tim Hijau' : 'Tim Biru'));
    const defaults = defaultTeamCharacters(initialTeam);
    let nextCharacters = initialCharacters || defaults;
    const untouched = nextCharacters.every((slot, index) => {
      const original = defaults[index];
      return (
        original &&
        slot.slot === original.slot &&
        slot.characterId === original.characterId &&
        slot.name === original.name
      );
    });
    if (!onUpdate && !isEditMode && !teams?.[initialTeam].connected && untouched) {
      try {
        const preferred = localStorage.getItem('medical:preferredHero');
        if (preferred && CHARACTERS.some((hero) => hero.id === preferred)) {
          nextCharacters = nextCharacters.map((slot) =>
            slot.slot === 0 ? { ...slot, characterId: preferred } : slot,
          ) as Slots;
        }
      } catch {
        // Storage restrictions leave the room's original roster intact.
      }
    }
    setCharacters(nextCharacters);
    setCandidate(null);
    // Drafts belong to this team; incoming opponent updates must not erase them.
  }, [initialTeam, roomCode]);
  useEffect(() => {
    if (lockCharacters) {
      setGallery(false);
      setCandidate(null);
    }
  }, [lockCharacters]);

  const run = async (action: () => Promise<void> | void) => {
    setLocalError('');
    setSaving(true);
    try {
      await action();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Perubahan belum tersimpan.');
      throw e;
    } finally {
      setSaving(false);
    }
  };
  const changeTeam = (side: Team) => {
    if (isEditMode || pending || side === team || teams?.[side].connected) return;
    setTeam(side);
    setActiveSlot(0);
    setCandidate(null);
    setTeamName(teams?.[side].name || (side === 'A' ? 'Tim Hijau' : 'Tim Biru'));
    setCharacters(teams?.[side].characters || defaultTeamCharacters(side));
    onTeamChange?.(side);
  };
  const saveName = async (name: string) => {
    if (onUpdate) await run(() => onUpdate({ teamName: name }));
    else setTeamName(name);
  };
  const saveSlotName = async (slot: number, name: string) => {
    if (onUpdate) await run(() => onUpdate({ characterNames: [{ slot, name }] }));
    else
      setCharacters(
        (previous) => previous.map((ch) => (ch.slot === slot ? { ...ch, name } : ch)) as Slots,
      );
  };
  const applyCharacter = async (id: string) => {
    if (lockCharacters) throw new Error('Karakter dikunci setelah pertandingan dimulai.');
    if (pending) throw new Error('Tunggu perubahan sebelumnya selesai disimpan.');
    if (!editable || !connected) throw new Error('Pengendali tim belum siap.');
    const updated = ownCharacters.map((ch) =>
      ch.slot === activeSlot ? { ...ch, characterId: id } : ch,
    ) as Slots;
    await run(async () => {
      if (onUpdate) await onUpdate({ characters: updated });
      else setCharacters(updated);
      setCandidate(null);
      setGallery(false);
      playSound('select');
    });
  };
  const complete =
    ownCharacters.length === 3 &&
    ownCharacters.every(
      (ch) => ch.name.trim() && CHARACTERS.some((def) => def.id === ch.characterId),
    );

  return (
    <section
      className={`team-selection ${lockCharacters ? 'ts-names-only' : ''}`}
      aria-label="Pemilihan tim"
    >
      <header className="ts-topbar">
        <a href="/" className="ts-brand">
          <Activity size={34} />
          <span>
            MEDICAL<strong>TUG OF WAR</strong>
            <small>Healthcare Heroes Quiz Battle</small>
          </span>
        </a>
        <div className="ts-room-meta">
          <span>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'LIVE ROOM' : 'MENGHUBUNGKAN'}
          </span>
          <b>{roomCode}</b>
          {onCancel && (
            <button
              type="button"
              className="ts-icon-button"
              aria-label="Tutup pemilihan tim"
              onClick={onCancel}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>
      <div className="ts-heading">
        <span className="ts-eyebrow">BUILD YOUR HEALTHCARE SQUAD</span>
        <h1>
          {lockCharacters ? (
            <>
              TEAM <em>IDENTITY</em>
            </>
          ) : (
            <>
              TEAM <em>SELECTION</em>
            </>
          )}
        </h1>
        <p>
          {lockCharacters
            ? 'Perbarui nama tim dan hero selama pertandingan.'
            : 'Pilih 3 Hero untuk Setiap Tim'}
          <span>{roomTitle || packageName}</span>
        </p>
      </div>
      {!isEditMode && (
        <div className="ts-controller-choice" aria-label="Pilih tim pengendali">
          {(['A', 'B'] as Team[]).map((side) => (
            <button
              key={side}
              type="button"
              className={`ts-choose-team ts-${side.toLowerCase()} ${team === side ? 'selected' : ''}`}
              disabled={pending || Boolean(teams?.[side].connected)}
              aria-pressed={team === side}
              onClick={() => changeTeam(side)}
            >
              <Users size={16} />
              {teams?.[side].connected ? 'Sudah ada pengendali · ' : 'Kendalikan · '}TEAM{' '}
              {side === 'A' ? 'GREEN' : 'BLUE'}
            </button>
          ))}
        </div>
      )}
      {(error || localError) && (
        <div className="ts-error" role="alert">
          {localError || error}
        </div>
      )}
      <div className="ts-versus-layout">
        {(['A', 'B'] as Team[]).map((side) => {
          const mine = team === side;
          const canEdit = mine && editable;
          const slots = mine
            ? ownCharacters
            : teams?.[side].characters || defaultTeamCharacters(side);
          const name = mine
            ? ownName
            : teams?.[side].name || (side === 'A' ? 'Tim Hijau' : 'Tim Biru');
          const isReady = mine ? ready : Boolean(teams?.[side].ready);
          return (
            <section
              key={side}
              className={`ts-team-panel ts-${side.toLowerCase()} ${mine ? 'is-own-team' : 'is-opponent'} ${isReady ? 'is-ready' : ''}`}
              aria-label={`TEAM ${side === 'A' ? 'GREEN' : 'BLUE'}`}
            >
              <header className="ts-team-heading">
                <div>
                  <span className="ts-team-kicker">
                    <ShieldCheck size={14} />
                    TEAM {side === 'A' ? 'GREEN' : 'BLUE'}
                  </span>
                  <NameEditor
                    key={`${side}-name`}
                    value={name}
                    label={`Edit nama tim ${side === 'A' ? 'Green' : 'Blue'}`}
                    maxLength={40}
                    disabled={!canEdit || pending || !connected}
                    onSave={saveName}
                  />
                </div>
                <span className={`ts-ownership ${mine ? 'owned' : ''}`}>
                  {mine ? (
                    <>
                      <Check size={12} />
                      TIM ANDA
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={12} />
                      TIM LAWAN
                    </>
                  )}
                </span>
              </header>
              <div className="ts-slots">
                {slots.map((slot, i) => {
                  const previewId =
                    mine && activeSlot === slot.slot && candidate ? candidate : slot.characterId;
                  const def = CHARACTERS.find((c) => c.id === previewId) || CHARACTERS[0];
                  const selected = mine && activeSlot === slot.slot;
                  return (
                    <article
                      key={slot.slot}
                      className={`ts-hero-slot ${selected ? 'is-active' : ''} ${mine && selected && candidate ? 'has-draft' : ''}`}
                      style={{ '--hero-color': def.accent || def.color } as CSSProperties}
                    >
                      <button
                        type="button"
                        className="ts-portrait-button"
                        disabled={!canEdit || lockCharacters || pending}
                        aria-label={`Aktifkan slot ${i + 1} ${side === 'A' ? 'Green' : 'Blue'}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setActiveSlot(slot.slot);
                          setCandidate(null);
                        }}
                      >
                        <span className="ts-slot-number">0{i + 1}</span>
                        <img src={def.thumbnailPath} alt={def.name} draggable={false} />
                        <span className="ts-portrait-halo" />
                        <span className="ts-profession">{def.profession}</span>
                        {isReady && <CheckCheck className="ts-slot-ready" size={18} />}
                      </button>
                      <div className="ts-slot-info">
                        <NameEditor
                          key={`${side}-${slot.slot}`}
                          value={slot.name}
                          label={`Edit nama pemain slot ${i + 1} ${side === 'A' ? 'Green' : 'Blue'}`}
                          maxLength={30}
                          disabled={!canEdit || pending || !connected}
                          onSave={(value) => saveSlotName(slot.slot, value)}
                        />
                        <span className="ts-character-origin">{def.name}</span>
                        {canEdit && !lockCharacters ? (
                          <button
                            type="button"
                            className="ts-change-character"
                            disabled={pending || !connected}
                            aria-label={`Ganti karakter slot ${i + 1}`}
                            onClick={() => {
                              setActiveSlot(slot.slot);
                              setCandidate(null);
                              setGallery(true);
                            }}
                          >
                            GANTI KARAKTER <ChevronRight size={13} />
                          </button>
                        ) : (
                          <span className="ts-slot-lock">
                            <LockKeyhole size={11} />
                            {lockCharacters ? 'Hero terkunci' : 'Dikelola tim lawan'}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <footer className="ts-team-footer">
                <span className={isReady ? 'ready' : ''}>
                  {isReady ? <CheckCheck size={15} /> : <Users size={15} />}
                  {isReady ? 'READY TO BATTLE' : 'MENYIAPKAN TIM'}
                </span>
                <small>
                  {mine
                    ? '1 pengendali · 3 hero'
                    : teams?.[side].connected
                      ? 'Pengendali terhubung'
                      : 'Menunggu pengendali'}
                </small>
              </footer>
            </section>
          );
        })}
        <div className="ts-vs" aria-hidden="true">
          <Swords size={20} />
          <b>VS</b>
        </div>
      </div>
      {!lockCharacters && (
        <section className="ts-collection" aria-label="Pilihan hero">
          <div className="ts-collection-heading">
            <div>
              <span className="ts-eyebrow">YOUR NEXT HERO</span>
              <h2>
                Pilih hero untuk <span>slot 0{activeSlot + 1}</span>
              </h2>
            </div>
            <div className="ts-carousel-nav">
              <span>{CHARACTERS.length} HERO</span>
              <button
                type="button"
                className="ts-icon-button"
                aria-label="Hero sebelumnya"
                onClick={() => strip.current?.scrollBy({ left: -400, behavior: 'smooth' })}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="ts-icon-button"
                aria-label="Hero berikutnya"
                onClick={() => strip.current?.scrollBy({ left: 400, behavior: 'smooth' })}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="ts-character-strip" ref={strip}>
            {CHARACTERS.map((def) => (
              <button
                key={def.id}
                type="button"
                disabled={!editable || pending || !connected}
                className={`ts-mini-card ${activeDef.id === def.id ? 'selected' : ''}`}
                aria-label={`Pratinjau ${def.name}`}
                aria-pressed={activeDef.id === def.id}
                onClick={() => {
                  setCandidate(def.id);
                  playSound('select');
                }}
                style={{ '--hero-color': def.accent || def.color } as CSSProperties}
              >
                <img src={def.thumbnailPath} alt="" draggable={false} />
                <span>
                  <strong>{def.name}</strong>
                  <small>{def.profession}</small>
                </span>
                {activeDef.id === def.id && <Check size={13} />}
              </button>
            ))}
          </div>
          {candidate && (
            <div className="ts-draft-confirm" role="status">
              <span>
                <Sparkles size={16} />
                <strong>{activeDef.name}</strong> untuk slot 0{activeSlot + 1}
                <small>Nama pemain tetap {active.name}.</small>
              </span>
              <div>
                <button
                  type="button"
                  className="ts-subtle"
                  disabled={pending}
                  onClick={() => setCandidate(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="ts-gold-button"
                  disabled={pending || !connected}
                  onClick={() => {
                    void applyCharacter(candidate).catch(() => {});
                  }}
                >
                  KONFIRMASI HERO <Check size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      <footer className="ts-bottom-bar">
        <p>
          <ShieldCheck size={18} />
          <span>
            {lockCharacters
              ? 'Nama tersinkron tanpa mengubah skor atau jawaban.'
              : ready
                ? 'Tim siap. Pertandingan akan dimulai oleh admin.'
                : 'Dua pengendali. Enam hero. Satu tujuan.'}
            <small>
              {lockCharacters
                ? 'Komposisi hero terkunci sampai pertandingan berakhir.'
                : 'Setiap tim menjawab satu pertanyaan bersama.'}
            </small>
          </span>
        </p>
        {!lockCharacters && (
          <button
            type="button"
            className={`ts-gold-button ts-ready-button ${ready ? 'is-confirmed' : ''}`}
            disabled={!editable || !complete || pending || !connected || Boolean(candidate)}
            onClick={() => {
              void run(async () => {
                if (onReady) await onReady();
                else await onConfirm({ team, teamName: ownName, characters: ownCharacters });
              }).catch(() => {});
            }}
          >
            {pending
              ? 'MENYIMPAN…'
              : onReady
                ? ready
                  ? 'BATALKAN READY'
                  : 'TIM SAYA SIAP'
                : 'KONFIRMASI TIM & READY'}
            {ready ? <CheckCheck size={18} /> : <ArrowRight size={18} />}
          </button>
        )}
        {lockCharacters && onCancel && (
          <button type="button" className="ts-gold-button" onClick={onCancel}>
            KEMBALI KE GAME <ArrowRight size={17} />
          </button>
        )}
      </footer>
      {gallery && (
        <CharacterGalleryView
          selectedId={active.characterId}
          team={team}
          title={`Pilih hero · Slot ${activeSlot + 1}`}
          onClose={() => setGallery(false)}
          onConfirm={applyCharacter}
        />
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CreditCard,
  Gamepad2,
  Heart,
  Info,
  LogOut,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Quality } from '../../../packages/shared/src';
import { api } from '../lib/api';
import { configureAudio, playSound, setMuted as muteAudio, stopMusic } from '../lib/audio';
import {
  DEFAULT_GAME_PREFS,
  readGamePrefs,
  readLastQuickSession,
  saveGamePrefs,
  type GamePrefs,
  type PublicPackageSummary,
  type QuickMatchSession,
} from '../lib/gamePrefs';
import './home.css';

const Arena = dynamic(() => import('../components/arena/Arena'), {
  ssr: false,
  loading: () => null,
});

type MenuId = 'continue' | 'start' | 'characters' | 'options' | 'credit' | 'admin' | 'quit';
type ModalId = 'options' | 'credit' | 'ranking';

type PublicLeader = {
  id: string;
  name: string;
  team: string;
  score: number;
  correctCount: number;
  power: number;
  matches: number;
};

export default function HomePage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<GamePrefs>(DEFAULT_GAME_PREFS);
  const [muted, setMuted] = useState(true);
  const [live3d, setLive3d] = useState(false);
  // Default highlighted menu is NEW GAME ('start') matching the reference design
  const [activeId, setActiveId] = useState<MenuId>('start');
  const [popout, setPopout] = useState<MenuId | null>(null);
  const [modal, setModal] = useState<ModalId | null>(null);
  const [navigatingTo, setNavigatingTo] = useState<MenuId | null>(null);
  const [confirmChoice, setConfirmChoice] = useState<'yes' | 'no'>('yes');
  const [quitNotice, setQuitNotice] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [lastSession, setLastSession] = useState<QuickMatchSession | null>(null);
  const [packages, setPackages] = useState<PublicPackageSummary[]>([]);
  const [leaders, setLeaders] = useState<PublicLeader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  const mounted = useRef(true);
  const artWrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    const savedPrefs = readGamePrefs();
    setPrefs(savedPrefs);
    setLastSession(readLastQuickSession());
    muteAudio(true);
    configureAudio({
      sound: savedPrefs.sound,
      music: savedPrefs.music,
      volume: savedPrefs.volume,
    });

    // Pre-warm primary routes so confirming a menu is instantaneous
    router.prefetch('/play');
    router.prefetch('/characters');
    router.prefetch('/admin/login');

    api<{ packages: PublicPackageSummary[] }>('/public/packages')
      .then((res) => {
        if (!mounted.current) return;
        setPackages(res.packages);
        if (!savedPrefs.packageId && res.packages[0]?.id) {
          const updated = saveGamePrefs({ packageId: res.packages[0].id });
          setPrefs(updated);
        }
      })
      .catch(() => {
        /* Fallback cleanly if API is booting or offline. */
      });

    return () => {
      mounted.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopMusic();
    };
  }, [router]);

  const updatePrefs = useCallback((patch: Partial<GamePrefs>) => {
    setPrefs((prev) => {
      const next = saveGamePrefs({ ...prev, ...patch });
      configureAudio({ sound: next.sound, music: next.music, volume: next.volume });
      return next;
    });
  }, []);

  const toggleSound = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    muteAudio(nextMuted);
    if (!nextMuted) playSound('ready');
  };

  const openRanking = useCallback(() => {
    playSound('click');
    setPopout(null);
    setModal('ranking');
    setLeadersLoading(true);
    api<PublicLeader[]>('/public/leaderboard')
      .then((rows) => {
        if (mounted.current) setLeaders(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (mounted.current) setLeaders([]);
      })
      .finally(() => {
        if (mounted.current) setLeadersLoading(false);
      });
  }, []);

  const handleQuitGame = useCallback(async () => {
    playSound('click');
    try {
      await fetch('/system-api/shutdown?immediate=1', { method: 'POST' });
    } catch {
      /* ignore */
    }
    window.close();
    if (mounted.current) {
      setQuitNotice('Tutup tab atau jendela ini untuk keluar dari game.');
    }
  }, []);

  // Execute the confirmed action for a menu item once the user chooses inside its popout
  const confirmMenuAction = useCallback(
    (id: MenuId) => {
      setQuitNotice('');
      if (id === 'start') {
        setPopout(null);
        setNavigatingTo('start');
        playSound('ready');
        router.push('/play');
        return;
      }
      if (id === 'characters') {
        setPopout(null);
        setNavigatingTo('characters');
        playSound('ready');
        router.push('/characters');
        return;
      }
      if (id === 'options') {
        setPopout(null);
        playSound('click');
        setModal('options');
        return;
      }
      if (id === 'credit') {
        setPopout(null);
        playSound('click');
        setModal('credit');
        return;
      }
      if (id === 'admin') {
        setPopout(null);
        setNavigatingTo('admin');
        playSound('click');
        router.push('/admin/login');
        return;
      }
      if (id === 'quit') {
        void handleQuitGame();
      }
    },
    [handleQuitGame, router],
  );

  // Clicking a sidebar item highlights it and toggles its confirmation/choice popout first
  const selectMenu = useCallback(
    (id: MenuId) => {
      playSound('select');
      setActiveId(id);
      setQuitNotice('');
      setRoomError('');

      if (popout === id) {
        setPopout(null);
        return;
      }

      setConfirmChoice(id === 'quit' ? 'no' : 'yes');
      setPopout(id);
    },
    [popout],
  );

  // Close popout on outside click
  useEffect(() => {
    if (!popout) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.welcome-menu-row')) {
        setPopout(null);
        setQuitNotice('');
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [popout]);

  // Keyboard arcade navigation (Arrow Up / Down / Left / Right / Enter / Escape)
  useEffect(() => {
    const order: MenuId[] = [
      'continue',
      'start',
      'characters',
      'options',
      'credit',
      'admin',
      'quit',
    ];
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          setPopout(null);
          setModal(null);
        }
        return;
      }
      if (modal) {
        if (e.key === 'Escape') setModal(null);
        return;
      }

      if (popout) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPopout(null);
          setQuitNotice('');
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playSound('select');
          if (popout === 'start') {
            updatePrefs({ playMode: prefs.playMode === 'local' ? 'bot' : 'local' });
          } else {
            setConfirmChoice((c) => (c === 'yes' ? 'no' : 'yes'));
          }
          return;
        }
        if (e.key === 'Enter' && popout !== 'continue') {
          e.preventDefault();
          if (popout === 'start') {
            confirmMenuAction('start');
          } else if (confirmChoice === 'yes') {
            confirmMenuAction(popout);
          } else {
            playSound('click');
            setPopout(null);
          }
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPopout(null);
        setActiveId((cur) => order[(order.indexOf(cur) + 1) % order.length]);
        playSound('select');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPopout(null);
        setActiveId((cur) => order[(order.indexOf(cur) - 1 + order.length) % order.length]);
        playSound('select');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMenu(activeId);
      } else if (e.key === 'Escape') {
        setPopout(null);
        setQuitNotice('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeId,
    confirmChoice,
    confirmMenuAction,
    modal,
    popout,
    prefs.playMode,
    selectMenu,
    updatePrefs,
  ]);

  const joinRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(cleaned)) {
      setRoomError('Kode 4-10 huruf/angka');
      return;
    }
    playSound('click');
    router.push(`/join/${cleaned}`);
  };

  // GPU-only parallax via ref + rAF: zero React re-renders while moving mouse across menus
  const handleShellMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (live3d || !artWrapRef.current) return;
      const x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * -14;
      const y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * -10;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (artWrapRef.current) {
          artWrapRef.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(1.03)`;
        }
      });
    },
    [live3d],
  );

  const renderConfirmPopout = (
    id: MenuId,
    tabTitle: string,
    yesLabel = 'MASUK',
    noLabel = 'BATAL',
  ) => (
    <div className="welcome-popout-card" role="dialog" aria-label={tabTitle}>
      <div className="welcome-popout-tab">{tabTitle}</div>
      <div className="welcome-popout-bar">
        <button
          type="button"
          className={`welcome-chevron-btn ${confirmChoice === 'yes' ? 'is-active' : ''}`}
          onMouseEnter={() => {
            if (confirmChoice !== 'yes') {
              setConfirmChoice('yes');
              playSound('select');
            }
          }}
          onClick={() => confirmMenuAction(id)}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          className={`welcome-chevron-btn ${confirmChoice === 'no' ? 'is-active' : ''}`}
          onMouseEnter={() => {
            if (confirmChoice !== 'no') {
              setConfirmChoice('no');
              playSound('select');
            }
          }}
          onClick={() => {
            playSound('click');
            setQuitNotice('');
            setPopout(null);
          }}
        >
          {noLabel}
        </button>
      </div>
      {id === 'quit' && quitNotice && (
        <p role="status" className="welcome-popout-notice">
          {quitNotice}
        </p>
      )}
    </div>
  );

  return (
    <div className="welcome-shell" onMouseMove={handleShellMouseMove}>
      {/* FULL-BLEED GAME ART BACKGROUND OR LIVE 3D ARENA */}
      <div className="welcome-stage">
        <div
          ref={artWrapRef}
          className="welcome-art-wrap"
          style={{
            transform: 'translate3d(0px, 0px, 0) scale(1.03)',
            opacity: live3d ? 0.14 : 1,
          }}
        >
          <img
            src="/images/welcome-hero-art.jpg"
            alt="Medical Tug of War Healthcare Heroes Battle"
            className="welcome-art-img"
            draggable={false}
          />
        </div>
        {live3d && (
          <div className="welcome-arena-live">
            <Arena preview theme={prefs.arena} quality={prefs.quality} />
          </div>
        )}
        <div className="welcome-sparks" aria-hidden="true" />
        <div className="welcome-stage-vignette" aria-hidden="true" />
      </div>

      {/* Accessible Title */}
      <h1 className="sr-only">Medical Tug of War — RSUD Al-Mulk Quiz Battle</h1>

      {/* SIGNATURE DIAGONAL CYAN SEAM + WHITE SLANTED MENU SURFACE */}
      <div className="welcome-seam-accent" aria-hidden="true" />
      <div className="welcome-white-panel" aria-hidden="true" />

      {/* TOP-LEFT ANGULAR GAME TITLE BANNER MATCHING REFERENCE IMAGE */}
      <header className="welcome-logo-banner">
        <div className="welcome-logo-backdrop">
          <div className="welcome-logo-crest" aria-hidden="true">
            <Gamepad2 size={32} strokeWidth={2.5} />
          </div>
          <div className="welcome-logo-text">
            <span className="welcome-logo-main">MEDICAL</span>
            <div className="welcome-logo-sub-row">
              <span className="welcome-logo-sub">TUG OF WAR</span>
            </div>
            <span className="welcome-logo-tag">RSUD AL-MULK • QUIZ BATTLE</span>
          </div>
        </div>
      </header>

      {/* TOP-RIGHT QUICK HUD CONTROLS */}
      <div className="welcome-top-hud">
        <button
          type="button"
          className={`welcome-hud-pill ${live3d ? 'is-on' : ''}`}
          onClick={() => {
            setLive3d((v) => !v);
            playSound('click');
          }}
        >
          <Sparkles size={15} />
          {live3d ? 'KEY ART MODE' : 'LIVE 3D ARENA'}
        </button>
        {live3d && (
          <button
            type="button"
            className="welcome-hud-pill"
            onClick={() => {
              const nextArena = prefs.arena === 'hospital' ? 'fantasy' : 'hospital';
              updatePrefs({ arena: nextArena });
              playSound('select');
            }}
          >
            <Heart size={14} />
            {prefs.arena === 'hospital' ? 'Hospital Battle' : 'Fantasy Battlefield'}
          </button>
        )}
        <button
          type="button"
          className="welcome-hud-pill"
          title="Papan Peringkat"
          onClick={openRanking}
        >
          <Trophy size={14} />
          RANKING
        </button>
        <button
          type="button"
          className="welcome-hud-icon-btn"
          aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          onClick={toggleSound}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* INTERACTIVE SLANTED ARCADE GAME MENU — 100% MATCHING REFERENCE IMAGE */}
      <nav className="welcome-menu-layer" aria-label="Menu Utama Game">
        <div className="welcome-menu-list">
          {/* 1. CONTINUE */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'continue' ? 'is-active' : ''}`}
              onClick={() => selectMenu('continue')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <Play size={22} strokeWidth={2.5} />
              </span>
              <span className="welcome-menu-label">CONTINUE</span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'continue' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Lanjutkan atau Gabung Room">
                <div className="welcome-popout-tab">
                  <Gamepad2 size={14} />
                  LANJUTKAN / GABUNG ?
                </div>
                <div className="welcome-popout-bar">
                  {lastSession && (
                    <button
                      type="button"
                      className="welcome-chevron-btn is-active is-cyan"
                      onClick={() => {
                        playSound('ready');
                        router.push(`/battle/${lastSession.code}`);
                      }}
                    >
                      RESUME ({lastSession.code})
                    </button>
                  )}
                  <form className="welcome-popout-room-form" onSubmit={joinRoomSubmit}>
                    <input
                      aria-label="KODE ROOM"
                      className="welcome-popout-input"
                      placeholder="KODE"
                      maxLength={10}
                      value={roomCode}
                      onChange={(e) => {
                        setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        setRoomError('');
                      }}
                      autoFocus={!lastSession}
                    />
                    <button type="submit" className="welcome-chevron-btn is-active">
                      JOIN
                    </button>
                  </form>
                  <button
                    type="button"
                    className="welcome-chevron-btn"
                    onClick={() => {
                      playSound('click');
                      setPopout(null);
                    }}
                  >
                    BATAL
                  </button>
                </div>
                {roomError && (
                  <p role="alert" className="welcome-popout-alert">
                    {roomError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. NEW GAME (START GAME) */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'start' ? 'is-active' : ''}`}
              onClick={() => selectMenu('start')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <Gamepad2 size={24} strokeWidth={2.4} />
              </span>
              <span className="welcome-menu-label">
                {navigatingTo === 'start' ? 'MEMBUKA…' : 'NEW GAME'}
              </span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'start' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Pilih Mode Permainan">
                <div className="welcome-popout-tab">
                  <Gamepad2 size={14} />
                  PILIH MODE PERMAINAN ?
                </div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${prefs.playMode === 'local' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (prefs.playMode !== 'local') {
                        updatePrefs({ playMode: 'local' });
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      updatePrefs({ playMode: 'local' });
                      confirmMenuAction('start');
                    }}
                  >
                    2 TIM LOKAL
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${prefs.playMode === 'bot' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (prefs.playMode !== 'bot') {
                        updatePrefs({ playMode: 'bot' });
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      updatePrefs({ playMode: 'bot' });
                      confirmMenuAction('start');
                    }}
                  >
                    VS BOT AI
                  </button>
                  <button
                    type="button"
                    className="welcome-chevron-btn"
                    onClick={() => {
                      playSound('click');
                      setPopout(null);
                    }}
                  >
                    BATAL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. HERO GALLERY */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'characters' ? 'is-active' : ''}`}
              onClick={() => selectMenu('characters')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <Users size={22} strokeWidth={2.4} />
              </span>
              <span className="welcome-menu-label">
                {navigatingTo === 'characters' ? 'MEMBUKA…' : 'HERO GALLERY'}
              </span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'characters' &&
              renderConfirmPopout('characters', 'BUKA HERO GALLERY ?', 'BUKA GALERI', 'BATAL')}
          </div>

          {/* 4. OPTIONS */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'options' ? 'is-active' : ''}`}
              onClick={() => selectMenu('options')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <Settings size={22} strokeWidth={2.4} />
              </span>
              <span className="welcome-menu-label">OPTIONS</span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'options' &&
              renderConfirmPopout('options', 'BUKA PENGATURAN ?', 'ATUR GAME', 'BATAL')}
          </div>

          {/* 5. CREDIT */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'credit' ? 'is-active' : ''}`}
              onClick={() => selectMenu('credit')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <CreditCard size={22} strokeWidth={2.4} />
              </span>
              <span className="welcome-menu-label">CREDIT</span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'credit' &&
              renderConfirmPopout('credit', 'LIHAT CREDIT & PANDUAN ?', 'BUKA INFO', 'BATAL')}
          </div>

          {/* 6. ADMIN PANEL */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'admin' ? 'is-active' : ''}`}
              onClick={() => selectMenu('admin')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <ShieldCheck size={22} strokeWidth={2.4} />
              </span>
              <span className="welcome-menu-label">
                {navigatingTo === 'admin' ? 'MEMBUKA…' : 'ADMIN PANEL'}
              </span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'admin' &&
              renderConfirmPopout('admin', 'MASUK PANEL ADMIN ?', 'LOGIN ADMIN', 'BATAL')}
          </div>

          {/* 7. QUIT GAME */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'quit' ? 'is-active' : ''}`}
              onClick={() => selectMenu('quit')}
            >
              <span className="welcome-menu-icon" aria-hidden="true">
                <LogOut size={22} strokeWidth={2.5} />
              </span>
              <span className="welcome-menu-label">QUIT GAME</span>
              <span className="welcome-menu-slash" aria-hidden="true" />
            </button>

            {popout === 'quit' &&
              renderConfirmPopout('quit', 'ARE YOU SURE ?', 'YES', 'NO')}
          </div>
        </div>
      </nav>

      {/* CONSOLE-STYLE KEY HINT HUD */}
      <div className="welcome-bottom-hud" aria-hidden="true">
        <div className="welcome-hint-bar">
          <span>
            <b className="welcome-keycap">↑↓</b> NAVIGASI
          </span>
          <span>
            <b className="welcome-keycap">A / ↵</b> KONFIRMASI
          </span>
        </div>
      </div>

      {/* RANKING / PAPAN PERINGKAT MODAL */}
      {modal === 'ranking' && (
        <div className="welcome-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Papan Peringkat"
          >
            <div className="welcome-modal-top">
              <h2>
                <Trophy size={20} /> PAPAN PERINGKAT • HALL OF HEROES
              </h2>
              <button
                type="button"
                className="welcome-modal-close"
                onClick={() => setModal(null)}
                aria-label="Tutup papan peringkat"
              >
                <X size={18} />
              </button>
            </div>
            <div className="welcome-modal-body">
              {leadersLoading ? (
                <div className="welcome-rank-empty">Memuat peringkat pemain…</div>
              ) : leaders.length === 0 ? (
                <div className="welcome-rank-empty">
                  <Trophy size={34} />
                  <strong>Panggung Para Juara Masih Terbuka</strong>
                  <p>Selesaikan pertandingan untuk mencatatkan skor terbaik tim Anda.</p>
                </div>
              ) : (
                <div className="welcome-rank-list">
                  {leaders.slice(0, 10).map((player, index) => (
                    <div key={player.id} className="welcome-rank-row">
                      <span className={`welcome-rank-num rank-${index + 1}`}>#{index + 1}</span>
                      <div className="welcome-rank-info">
                        <strong>{player.name}</strong>
                        <small>
                          {player.correctCount} benar • {player.power} power
                        </small>
                      </div>
                      <span className="welcome-rank-score">{player.score} PTS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="welcome-modal-foot">
              <Link
                href="/play"
                className="welcome-cta-slanted"
                onClick={() => {
                  playSound('ready');
                  setModal(null);
                }}
              >
                MULAI BERTANDING <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* OPTIONS MODAL */}
      {modal === 'options' && (
        <div className="welcome-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Pengaturan Game"
          >
            <div className="welcome-modal-top">
              <h2>
                <Settings size={20} /> OPTIONS &amp; PENGATURAN GAME
              </h2>
              <button
                type="button"
                className="welcome-modal-close"
                onClick={() => setModal(null)}
                aria-label="Tutup pengaturan"
              >
                <X size={18} />
              </button>
            </div>
            <div className="welcome-modal-body">
              <div className="welcome-option-row">
                <label>Tema Arena 3D</label>
                <div className="welcome-option-pills">
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.arena === 'hospital' ? 'selected' : ''}`}
                    onClick={() => {
                      updatePrefs({ arena: 'hospital' });
                      playSound('select');
                    }}
                  >
                    <Heart size={15} /> Hospital Battle
                  </button>
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.arena === 'fantasy' ? 'selected' : ''}`}
                    onClick={() => {
                      updatePrefs({ arena: 'fantasy' });
                      playSound('select');
                    }}
                  >
                    <Swords size={15} /> Fantasy Battlefield
                  </button>
                </div>
              </div>

              <div className="welcome-option-row">
                <label htmlFor="opt-package">Paket Soal Default (Quick Start)</label>
                <select
                  id="opt-package"
                  className="welcome-option-select"
                  value={prefs.packageId}
                  onChange={(e) => updatePrefs({ packageId: e.target.value })}
                >
                  {packages.length === 0 ? (
                    <option value="">Paket Aktif Otomatis</option>
                  ) : (
                    packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.questionCount} soal)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="welcome-option-row">
                <label>Mode Kontrol Pertandingan</label>
                <div className="welcome-option-pills">
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.playMode === 'local' ? 'selected' : ''}`}
                    onClick={() => {
                      updatePrefs({ playMode: 'local' });
                      playSound('select');
                    }}
                  >
                    <Users size={15} /> 2 Tim Lokal (1 Layar)
                  </button>
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.playMode === 'bot' ? 'selected' : ''}`}
                    onClick={() => {
                      updatePrefs({ playMode: 'bot' });
                      playSound('select');
                    }}
                  >
                    <Gamepad2 size={15} /> 1P VS Bot AI
                  </button>
                </div>
              </div>

              <div className="welcome-option-row">
                <label>Audio &amp; Efek Suara ({Math.round(prefs.volume * 100)}%)</label>
                <div className="welcome-option-pills">
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.sound ? 'selected' : ''}`}
                    onClick={() => updatePrefs({ sound: !prefs.sound })}
                  >
                    SFX: {prefs.sound ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    className={`welcome-option-pill ${prefs.music ? 'selected' : ''}`}
                    onClick={() => updatePrefs({ music: !prefs.music })}
                  >
                    MUSIK: {prefs.music ? 'ON' : 'OFF'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.volume}
                  onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
                  className="welcome-range"
                  aria-label="Volume suara"
                />
              </div>

              <div className="welcome-option-row">
                <label>Kualitas Grafis 3D</label>
                <div className="welcome-option-pills three">
                  {(['AUTO', 'MEDIUM', 'HIGH'] as Quality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`welcome-option-pill ${prefs.quality === q ? 'selected' : ''}`}
                      onClick={() => updatePrefs({ quality: q })}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="welcome-modal-foot">
              <Link
                href="/play"
                className="welcome-cta-slanted"
                onClick={() => {
                  playSound('ready');
                  setModal(null);
                }}
              >
                LANJUT NEW GAME <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CREDIT & HOW TO PLAY MODAL */}
      {modal === 'credit' && (
        <div className="welcome-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Credit & Cara Bermain"
          >
            <div className="welcome-modal-top">
              <h2>
                <Info size={20} /> TENTANG &amp; CARA BERMAIN
              </h2>
              <button
                type="button"
                className="welcome-modal-close"
                onClick={() => setModal(null)}
                aria-label="Tutup credit"
              >
                <X size={18} />
              </button>
            </div>
            <div className="welcome-modal-body">
              <div className="welcome-credit-grid">
                <div className="welcome-credit-step">
                  <b>01</b>
                  <div>
                    <strong>Pilih Hero dari 2 Tim</strong>
                    <p>
                      Tekan NEW GAME lalu pilih 3 pahlawan kesehatan untuk Tim Hijau dan Tim Biru.
                    </p>
                  </div>
                </div>
                <div className="welcome-credit-step">
                  <b>02</b>
                  <div>
                    <strong>Jawab Kuis Tarik Tambang</strong>
                    <p>
                      Tim Hijau pakai tombol 1–4 (atau sentuh layar kiri) &amp; Tim Biru pakai 7–0
                      (atau lawan AI Bot). Setiap jawaban benar memberi tarikan kuat!
                    </p>
                  </div>
                </div>
                <div className="welcome-credit-step">
                  <b>03</b>
                  <div>
                    <strong>Tarik Sampai Garis Juara</strong>
                    <p>
                      Dikembangkan untuk edukasi keselamatan pasien &amp; PPI RSUD Al-Mulk dalam
                      kemasan arena kuis 3D interaktif.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="welcome-modal-foot">
              <Link
                href="/play"
                className="welcome-cta-slanted"
                onClick={() => {
                  playSound('ready');
                  setModal(null);
                }}
              >
                MULAI GAME SEKARANG <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

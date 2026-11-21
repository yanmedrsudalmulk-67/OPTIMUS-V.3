'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Gamepad2,
  Heart,
  Info,
  Play,
  Power,
  RotateCcw,
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

type MenuId = 'start' | 'continue' | 'characters' | 'options' | 'credit' | 'admin' | 'quit';
type PopoutId = MenuId;

export default function HomePage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<GamePrefs>(DEFAULT_GAME_PREFS);
  const [muted, setMuted] = useState(true);
  const [live3d, setLive3d] = useState(false);
  const [activeId, setActiveId] = useState<MenuId>('start');
  const [popout, setPopout] = useState<PopoutId | null>(null);
  const [modal, setModal] = useState<'options' | 'credit' | null>(null);
  const [confirmStart, setConfirmStart] = useState<'start' | 'cancel'>('start');
  const [confirmAdmin, setConfirmAdmin] = useState<'no' | 'yes'>('no');
  const [confirmQuit, setConfirmQuit] = useState<'no' | 'yes'>('no');
  const [confirmCharacters, setConfirmCharacters] = useState<'open' | 'cancel'>('open');
  const [confirmOptions, setConfirmOptions] = useState<'open' | 'cancel'>('open');
  const [confirmCredit, setConfirmCredit] = useState<'open' | 'cancel'>('open');
  const [roomCode, setRoomCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [lastSession, setLastSession] = useState<QuickMatchSession | null>(null);
  const [packages, setPackages] = useState<PublicPackageSummary[]>([]);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const mounted = useRef(true);

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
      stopMusic();
    };
  }, []);

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

  const handleQuitGame = useCallback(async () => {
    playSound('click');
    try {
      await fetch('/system-api/shutdown?immediate=1', { method: 'POST' });
    } catch {
      /* ignore */
    }
    window.close();
  }, []);

  const activateMenu = useCallback(
    (id: MenuId) => {
      playSound('click');
      if (activeId === id && popout === id) {
        // Fast-track: Clicking the same open menu item again executes action
        if (id === 'start') {
          playSound('ready');
          router.push('/play');
        } else if (id === 'characters') {
          router.push('/characters');
        } else if (id === 'options') {
          setPopout(null);
          setModal('options');
        } else if (id === 'credit') {
          setPopout(null);
          setModal('credit');
        } else if (id === 'admin') {
          if (confirmAdmin === 'yes') router.push('/admin/login');
          else setConfirmAdmin('yes');
        } else if (id === 'quit') {
          if (confirmQuit === 'yes') handleQuitGame();
          else setConfirmQuit('yes');
        }
        return;
      }

      setActiveId(id);
      setPopout(id);
      if (id === 'continue') setRoomError('');
      if (id === 'admin') setConfirmAdmin('no');
      if (id === 'quit') setConfirmQuit('no');
      if (id === 'start') setConfirmStart('start');
      if (id === 'characters') setConfirmCharacters('open');
      if (id === 'options') setConfirmOptions('open');
      if (id === 'credit') setConfirmCredit('open');
    },
    [activeId, confirmAdmin, confirmQuit, handleQuitGame, popout, router],
  );

  // Close popout on outside click
  useEffect(() => {
    if (!popout) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.welcome-menu-row')) {
        setPopout(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [popout]);

  // Keyboard arcade navigation (Arrow Up / Down / Left / Right / Enter / Escape)
  useEffect(() => {
    const order: MenuId[] = ['start', 'continue', 'characters', 'options', 'credit', 'admin', 'quit'];
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

      // If popout is open, handle left/right selection and enter execution
      if (popout) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPopout(null);
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playSound('select');
          if (popout === 'start') {
            setConfirmStart((c) => (c === 'start' ? 'cancel' : 'start'));
          } else if (popout === 'quit') {
            setConfirmQuit((c) => (c === 'no' ? 'yes' : 'no'));
          } else if (popout === 'admin') {
            setConfirmAdmin((c) => (c === 'no' ? 'yes' : 'no'));
          } else if (popout === 'characters') {
            setConfirmCharacters((c) => (c === 'open' ? 'cancel' : 'open'));
          } else if (popout === 'options') {
            setConfirmOptions((c) => (c === 'open' ? 'cancel' : 'open'));
          } else if (popout === 'credit') {
            setConfirmCredit((c) => (c === 'open' ? 'cancel' : 'open'));
          }
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          if (popout === 'start') {
            if (confirmStart === 'start') {
              playSound('ready');
              router.push('/play');
            } else {
              setPopout(null);
            }
          } else if (popout === 'quit') {
            if (confirmQuit === 'yes') {
              handleQuitGame();
            } else {
              setPopout(null);
            }
          } else if (popout === 'admin') {
            if (confirmAdmin === 'yes') {
              router.push('/admin/login');
            } else {
              setPopout(null);
            }
          } else if (popout === 'characters') {
            if (confirmCharacters === 'open') {
              router.push('/characters');
            } else {
              setPopout(null);
            }
          } else if (popout === 'options') {
            if (confirmOptions === 'open') {
              setPopout(null);
              setModal('options');
            } else {
              setPopout(null);
            }
          } else if (popout === 'credit') {
            if (confirmCredit === 'open') {
              setPopout(null);
              setModal('credit');
            } else {
              setPopout(null);
            }
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
        activateMenu(activeId);
      } else if (e.key === 'Escape') {
        setPopout(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeId,
    activateMenu,
    confirmAdmin,
    confirmCharacters,
    confirmCredit,
    confirmOptions,
    confirmQuit,
    confirmStart,
    handleQuitGame,
    modal,
    popout,
    router,
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

  return (
    <div
      className="welcome-shell"
      onMouseMove={(e) => {
        if (live3d) return;
        const x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * -14;
        const y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * -10;
        setParallax({ x, y });
      }}
    >
      {/* FULL-BLEED GAME ART BACKGROUND OR LIVE 3D ARENA */}
      <div className="welcome-stage">
        <div
          className="welcome-art-wrap"
          style={{
            transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.03)`,
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

      {/* SIGNATURE DIAGONAL CYAN SEAM + WHITE SLANTED MENU SURFACE (Mawiri style) */}
      <div className="welcome-seam-accent" aria-hidden="true" />
      <div className="welcome-white-panel" aria-hidden="true" />

      {/* TOP-LEFT ANGULAR GAME TITLE BANNER */}
      <header className="welcome-logo-banner">
        <div className="welcome-logo-backdrop">
          <div className="welcome-logo-crest" aria-hidden="true">
            <Activity size={32} strokeWidth={2.8} />
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
        <Link href="/admin/leaderboard" className="welcome-hud-pill" title="Papan Peringkat">
          <Trophy size={14} />
          RANKING
        </Link>
        <button
          type="button"
          className="welcome-hud-icon-btn"
          aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          onClick={toggleSound}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* INTERACTIVE SLANTED ARCADE GAME MENU */}
      <nav className="welcome-menu-layer" aria-label="Menu Utama Game">
        <div className="welcome-menu-list">
          {/* 1. START GAME (WITH SIGNATURE ATTACHED POPOUT) */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'start' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'start') {
                  setActiveId('start');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('start')}
            >
              <Play size={20} fill="currentColor" />
              START GAME
              <span className="welcome-menu-badge">2 TIM</span>
            </button>

            {popout === 'start' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Mulai Game">
                <div className="welcome-popout-tab">MULAI BATTLE ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmStart === 'start' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmStart !== 'start') {
                        setConfirmStart('start');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('ready');
                      router.push('/play');
                    }}
                  >
                    MULAI
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmStart === 'cancel' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmStart !== 'cancel') {
                        setConfirmStart('cancel');
                        playSound('select');
                      }
                    }}
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

          {/* 2. CONTINUE / GABUNG ROOM CODE */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'continue' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'continue') {
                  setActiveId('continue');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('continue')}
            >
              <RotateCcw size={19} />
              CONTINUE
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
                  <p
                    role="alert"
                    style={{
                      margin: '4px 0 0 10px',
                      padding: '3px 10px',
                      background: '#dc2626',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 3,
                      boxShadow: '2px 2px 0 #000',
                    }}
                  >
                    {roomError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. HERO GALLERY */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'characters' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'characters') {
                  setActiveId('characters');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('characters')}
            >
              <Users size={19} />
              HERO GALLERY
            </button>

            {popout === 'characters' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Hero Gallery">
                <div className="welcome-popout-tab">HERO GALLERY ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmCharacters === 'open' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmCharacters !== 'open') {
                        setConfirmCharacters('open');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('ready');
                      router.push('/characters');
                    }}
                  >
                    LIHAT
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmCharacters === 'cancel' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmCharacters !== 'cancel') {
                        setConfirmCharacters('cancel');
                        playSound('select');
                      }
                    }}
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

          {/* 4. OPTIONS */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'options' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'options') {
                  setActiveId('options');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('options')}
            >
              <Settings size={19} />
              OPTIONS
            </button>

            {popout === 'options' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Pengaturan Game">
                <div className="welcome-popout-tab">PENGATURAN ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmOptions === 'open' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmOptions !== 'open') {
                        setConfirmOptions('open');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('click');
                      setModal('options');
                      setPopout(null);
                    }}
                  >
                    BUKA
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmOptions === 'cancel' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmOptions !== 'cancel') {
                        setConfirmOptions('cancel');
                        playSound('select');
                      }
                    }}
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

          {/* 5. CREDIT & HOW TO PLAY */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'credit' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'credit') {
                  setActiveId('credit');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('credit')}
            >
              <Info size={19} />
              CREDIT
            </button>

            {popout === 'credit' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Info Game">
                <div className="welcome-popout-tab">INFO GAME ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmCredit === 'open' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmCredit !== 'open') {
                        setConfirmCredit('open');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('click');
                      setModal('credit');
                      setPopout(null);
                    }}
                  >
                    LIHAT
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmCredit === 'cancel' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmCredit !== 'cancel') {
                        setConfirmCredit('cancel');
                        playSound('select');
                      }
                    }}
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

          {/* 6. PANEL ADMIN (WITH MAWIRI SIGNATURE CONFIRMATION POPOUT) */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn ${activeId === 'admin' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'admin') {
                  setActiveId('admin');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('admin')}
            >
              <ShieldCheck size={19} />
              ADMIN PANEL
            </button>

            {popout === 'admin' && (
              <div className="welcome-popout-card" role="dialog" aria-label="Konfirmasi Panel Admin">
                <div className="welcome-popout-tab">BUKA RUANG ADMIN ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmAdmin === 'no' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmAdmin !== 'no') {
                        setConfirmAdmin('no');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('click');
                      setPopout(null);
                    }}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmAdmin === 'yes' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmAdmin !== 'yes') {
                        setConfirmAdmin('yes');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('click');
                      router.push('/admin/login');
                    }}
                  >
                    YES
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 7. QUIT GAME (EXACT REPLICA OF USER REFERENCE IMAGE) */}
          <div className="welcome-menu-row welcome-popout-anchor">
            <button
              type="button"
              className={`welcome-menu-btn is-quit ${activeId === 'quit' ? 'is-active' : ''}`}
              onMouseEnter={() => {
                if (activeId !== 'quit') {
                  setActiveId('quit');
                  playSound('select');
                }
              }}
              onClick={() => activateMenu('quit')}
            >
              <Power size={19} />
              QUIT GAME
            </button>

            {popout === 'quit' && (
              <div
                className="welcome-popout-card is-quit-popout"
                role="dialog"
                aria-label="Konfirmasi Keluar Game"
              >
                <div className="welcome-popout-tab">ARE YOU SURE ?</div>
                <div className="welcome-popout-bar">
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmQuit === 'no' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmQuit !== 'no') {
                        setConfirmQuit('no');
                        playSound('select');
                      }
                    }}
                    onClick={() => {
                      playSound('click');
                      setPopout(null);
                    }}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    className={`welcome-chevron-btn ${confirmQuit === 'yes' ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      if (confirmQuit !== 'yes') {
                        setConfirmQuit('yes');
                        playSound('select');
                      }
                    }}
                    onClick={handleQuitGame}
                  >
                    YES
                  </button>
                </div>
              </div>
            )}
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

      {/* OPTIONS MODAL */}
      {modal === 'options' && (
        <div className="welcome-modal-backdrop" onClick={() => setModal(null)}>
          <div className="welcome-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pengaturan Game">
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
              <button
                type="button"
                className="welcome-cta-slanted"
                onClick={() => {
                  playSound('ready');
                  setModal(null);
                  router.push('/play');
                }}
              >
                LANJUT START GAME <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDIT & HOW TO PLAY MODAL */}
      {modal === 'credit' && (
        <div className="welcome-modal-backdrop" onClick={() => setModal(null)}>
          <div className="welcome-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Credit & Cara Bermain">
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
                    <p>Tekan START GAME lalu pilih 3 pahlawan kesehatan untuk Tim Hijau dan Tim Biru.</p>
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
              <button
                type="button"
                className="welcome-cta-slanted"
                onClick={() => {
                  playSound('ready');
                  setModal(null);
                  router.push('/play');
                }}
              >
                START GAME SEKARANG <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

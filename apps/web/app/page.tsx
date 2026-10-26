'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Gamepad2,
  Heart,
  HelpCircle,
  Home,
  LayoutGrid,
  Leaf,
  LogIn,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CHARACTERS } from '../../../packages/shared/src';
import { setMuted as muteAudio, playSound } from '../lib/audio';
import './home.css';
const Arena = dynamic(() => import('../components/arena/Arena'), {
  ssr: false,
  loading: () => (
    <div className="home-arena-loading">
      <span className="spinner" />
      <p>Menyiapkan para hero…</p>
    </div>
  ),
});
export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(true);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<'hospital' | 'fantasy'>('hospital');
  function join(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(value)) {
      setError('Masukkan kode room yang diberikan host.');
      return;
    }
    playSound('click');
    router.push(`/join/${value}`);
  }
  return (
    <div className="home-app">
      <aside className={`home-sidebar ${menu ? 'is-open' : ''}`}>
        <Link href="/" className="home-brand">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            MEDICAL<span>TUG OF WAR</span>
          </span>
        </Link>
        <button
          className="home-mobile-close btn btn-icon"
          onClick={() => setMenu(false)}
          aria-label="Tutup menu"
        >
          <X />
        </button>
        <p className="home-nav-label">PLAY & EXPLORE</p>
        <nav className="home-nav">
          <Link className="active" href="/">
            <LayoutGrid size={18} />
            Beranda
            <span className="nav-dot" />
          </Link>
          <Link href="/admin/matches/new">
            <Swords size={18} />
            Buat pertandingan
          </Link>
          <Link href="/admin/questions">
            <BookOpen size={18} />
            Bank soal
          </Link>
          <Link href="/admin/characters">
            <Users size={18} />
            Galeri karakter
          </Link>
          <Link href="/admin/matches">
            <ClipboardList size={18} />
            Riwayat pertandingan
          </Link>
          <Link href="/admin/leaderboard">
            <Trophy size={18} />
            Leaderboard
          </Link>
        </nav>
        <div className="home-sidebar-guide">
          <div className="home-guide-icon">
            <Sparkles size={19} />
          </div>
          <h3>
            Belajar. Bermain.
            <br />
            Menang bersama.
          </h3>
          <p>Ubah pengetahuan kesehatan menjadi kekuatan tim.</p>
          <a href="#cara-bermain">
            Kenali permainannya <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="home-sidebar-footer">
          <span className="home-avatar">
            <ShieldCheck size={18} />
          </span>
          <span>
            <strong>Panel administrator</strong>
            <small>Kelola pengalaman bermain</small>
          </span>
          <Link href="/admin/login" aria-label="Masuk admin">
            <LogIn size={17} />
          </Link>
        </div>
      </aside>
      {menu && <div className="home-menu-scrim" onClick={() => setMenu(false)} />}
      <div className="home-main">
        <header className="home-topbar">
          <div className="row">
            <button
              className="home-menu-button btn btn-icon"
              onClick={() => setMenu(true)}
              aria-label="Buka menu"
            >
              <Menu size={19} />
            </button>
            <span className="home-breadcrumb">
              Playground <ChevronRight size={13} />
              <strong>Beranda</strong>
            </span>
          </div>
          <div className="row">
            <span className="home-online">
              <i />
              MULTIPLAYER • 3 VS 3
            </span>
            <Link href="/admin/login" className="home-top-login">
              Masuk admin <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        <main className="home-content">
          <section className="home-welcome">
            <div>
              <div className="home-welcome-tag">
                <span /> HEALTHCARE HEROES QUIZ BATTLE
              </div>
              <h1>
                Pengetahuanmu. <span>Kekuatan timmu.</span>
              </h1>
              <p>Bukan sekadar kuis. Ini saatnya para pahlawan kesehatan beraksi.</p>
            </div>
            <Link href="/admin/matches/new" className="btn btn-primary">
              <Plus size={17} />
              Buat pertandingan
            </Link>
          </section>
          <div className="home-play-layout">
            <section className="home-battle-card">
              <div className="home-battle-header">
                <div>
                  <span className="eyebrow">MASUK KE ARENA</span>
                  <h2>Satu tim. Satu tarikan.</h2>
                </div>
                <span className="home-live-pill">
                  <i />
                  PREVIEW ARENA
                </span>
              </div>
              <div className="home-arena-wrap">
                <Arena preview theme={theme} />
                <div className="home-arena-top">
                  <span className="home-team-label green">
                    <ShieldCheck size={16} />
                    TIM EMERALD <b>3</b>
                  </span>
                  <span className="home-vs">VS</span>
                  <span className="home-team-label blue">
                    <b>3</b>TIM SAPPHIRE <ShieldCheck size={16} />
                  </span>
                </div>
                <button
                  aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
                  className="home-sound-button"
                  onClick={() => {
                    setMuted(!muted);
                    muteAudio(!muted);
                    if (muted) playSound('ready');
                  }}
                >
                  {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <div className="home-arena-bottom">
                  <span>
                    <i />6 HERO · 1 TAMBANG · PENGETAHUAN TANPA BATAS
                  </span>
                  <span className="home-camera-tag">3D LIVE ARENA</span>
                </div>
              </div>
              <div className="home-arena-footer">
                <div className="home-theme-tabs">
                  <button
                    className={theme === 'hospital' ? 'selected' : ''}
                    onClick={() => setTheme('hospital')}
                  >
                    <Heart size={14} />
                    Hospital Battle
                  </button>
                  <button
                    className={theme === 'fantasy' ? 'selected' : ''}
                    onClick={() => setTheme('fantasy')}
                  >
                    <Swords size={14} />
                    Fantasy Battlefield
                  </button>
                </div>
                <Link href="/admin/characters">
                  Jelajahi hero <ArrowRight size={15} />
                </Link>
              </div>
            </section>
            <aside className="home-right">
              <form className="home-join-card" onSubmit={join}>
                <span className="home-small-icon">
                  <Gamepad2 size={22} />
                </span>
                <span className="eyebrow">SUDAH PUNYA TIM?</span>
                <h2>
                  Gabung ke
                  <br />
                  pertandingan.
                </h2>
                <p>
                  Masukkan kode room dari host.
                  <br />
                  Hero-mu sudah menunggu!
                </p>
                <label htmlFor="room-code">KODE ROOM</label>
                <input
                  id="room-code"
                  name="code"
                  className="home-room-input"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    setError('');
                  }}
                  placeholder="MED729"
                  maxLength={10}
                  autoComplete="off"
                  required
                />
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary" type="submit">
                  Masuk arena <ArrowRight size={17} />
                </button>
                <span className="home-no-account">
                  <ShieldCheck size={13} />
                  Tanpa akun. Langsung bermain.
                </span>
              </form>
              <div className="home-quick-note">
                <div className="home-note-symbol">
                  <Users size={21} />
                </div>
                <div>
                  <strong>Lebih seru bersama.</strong>
                  <p>Siapkan 6 pemain, smartphone, dan satu layar besar.</p>
                </div>
              </div>
            </aside>
          </div>
          <section className="home-how" id="cara-bermain">
            <div className="section-title">
              <div>
                <span className="eyebrow">SEDERHANA. SERU. KOMPETITIF.</span>
                <h2>Siap jadi tim terkuat?</h2>
              </div>
              <span className="home-how-caption">
                Tiga langkah menuju kemenangan <ArrowDown size={14} />
              </span>
            </div>
            <div className="home-steps">
              <div className="home-step">
                <span className="home-step-icon green">
                  <Users size={22} />
                </span>
                <div>
                  <span className="home-step-number">01 / KUMPULKAN TIM</span>
                  <h3>Pilih hero, satukan kekuatan</h3>
                  <p>Gabung lewat kode room. Pilih karakter favorit dan bersiap bersama timmu.</p>
                </div>
              </div>
              <div className="home-step">
                <span className="home-step-icon blue">
                  <BookOpen size={22} />
                </span>
                <div>
                  <span className="home-step-number">02 / JAWAB TANTANGAN</span>
                  <h3>Jawaban benar, tarikan kuat</h3>
                  <p>
                    Jawab kuis kesehatan dari smartphone. Setiap jawaban benar berarti 10 power.
                  </p>
                </div>
              </div>
              <div className="home-step">
                <span className="home-step-icon yellow">
                  <Trophy size={22} />
                </span>
                <div>
                  <span className="home-step-number">03 / RAIH KEMENANGAN</span>
                  <h3>Tarik sampai garis juara</h3>
                  <p>Saksikan hero-mu bertanding di arena 3D. Tim paling kompak yang menang!</p>
                </div>
              </div>
            </div>
          </section>
          <section className="home-hero-strip">
            <div>
              <div className="home-hero-count">
                <Heart size={17} />
                <span>8 HERO KESEHATAN</span>
              </div>
              <h3>Beda profesi. Semangat yang sama.</h3>
              <p>Temukan karakter yang mewakili dirimu.</p>
            </div>
            <div className="home-professions">
              {CHARACTERS.slice(0, 5).map((c) => (
                <Link href="/admin/characters" className="home-profession" key={c.id}>
                  <span style={{ background: `${c.color}20`, color: c.color }}>
                    {c.id.startsWith('doctor') ? (
                      <Heart size={20} />
                    ) : c.id.startsWith('nurse') ? (
                      <Activity size={20} />
                    ) : (
                      <Leaf size={20} />
                    )}
                  </span>
                  <small>{c.profession}</small>
                </Link>
              ))}
              <Link className="home-all-heroes" href="/admin/characters">
                <ArrowUpRight size={22} />
                <small>Semua hero</small>
              </Link>
            </div>
          </section>
          <footer className="home-footer">
            <span>
              <Activity size={13} /> DIBUAT UNTUK PAHLAWAN KESEHATAN
            </span>
            <span>Belajar lebih bermakna, bersama.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

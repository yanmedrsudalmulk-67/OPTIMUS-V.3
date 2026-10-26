'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import Dashboard from './Dashboard';
import QuestionManager from './QuestionManager';
import { CreateMatch, HostMatch, MatchHistory, Leaderboard } from './Matches';
import { CharacterGallery, GameSettingsPage, AdministratorSettings } from './Settings';
import { ErrorNotice, errorText, Loading } from './AdminCommon';
import './admin.css';

const nav = [
  { href: '/admin/dashboard', title: 'Ringkasan', icon: LayoutDashboard },
  { href: '/admin/matches/new', title: 'Pertandingan baru', icon: Swords },
  { href: '/admin/matches', title: 'Riwayat pertandingan', icon: Gamepad2 },
  { href: '/admin/questions', title: 'Bank soal', icon: BookOpen },
  { href: '/admin/packages', title: 'Paket soal', icon: BookOpen },
  { href: '/admin/characters', title: 'Galeri karakter', icon: Users },
  { href: '/admin/leaderboard', title: 'Papan peringkat', icon: Trophy },
  { href: '/admin/settings', title: 'Pengaturan game', icon: Settings2 },
];

function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="admin-login">
      <div className="login-brand">
        <Link href="/" className="admin-brand">
          <span className="brand-symbol">
            <Activity size={25} />
          </span>
          <span>
            MEDICAL<span className="brand-sub">TUG OF WAR</span>
          </span>
        </Link>
        <div className="login-pitch">
          <span className="eyebrow">HEALTHCARE HEROES QUIZ BATTLE</span>
          <h1>
            Pengetahuan kuat.
            <br />
            Tim lebih hebat.
          </h1>
          <p>Siapkan soal, kumpulkan para pahlawan, dan mulai pertandingan yang berkesan.</p>
          <div className="login-illustration">
            <ShieldCheck size={78} />
            <Swords size={112} />
            <Trophy size={78} />
          </div>
        </div>
        <p className="muted">Dibuat untuk belajar, bertanding, dan bertumbuh bersama.</p>
      </div>
      <div className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
              });
              getSocket().disconnect().connect();
              router.push('/admin/dashboard');
              router.refresh();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-icon">
            <ShieldCheck size={28} />
          </span>
          <h2>Selamat datang kembali</h2>
          <p className="muted">Masuk untuk mengelola pertandingan dan bank soal.</p>
          <ErrorNotice error={error} />
          <label className="field">
            Nama pengguna
            <input
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Nama pengguna admin"
            />
          </label>
          <label className="field">
            Kata sandi
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Masukkan kata sandi"
            />
          </label>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Menghubungkan…' : 'Masuk ke dashboard'}
            <ArrowUpRight size={18} />
          </button>
          <p className="login-note">
            <ShieldCheck size={14} /> Akses khusus administrator. Akun dibuat melalui perintah{' '}
            <code>npm run admin:create</code>.
          </p>
          <Link className="back-link" href="/">
            <ArrowLeft size={15} /> Kembali ke beranda
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function AdminRouter() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }
    let active = true;
    api<{ id: string; username: string }>('/auth/me')
      .then((u) => {
        if (active) {
          setUser(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) router.replace('/admin/login');
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);
  useEffect(() => setMobile(false), [pathname]);
  if (pathname === '/admin/login') return <Login />;
  if (loading || !user) return <Loading />;
  const section =
    nav.find((n) => n.href === pathname)?.title ||
    (pathname.startsWith('/admin/matches/') ? 'Kontrol pertandingan' : 'Ringkasan');
  let page: ReactNode;
  if (pathname === '/admin/questions' || pathname === '/admin/packages')
    page = <QuestionManager packagesOnly={pathname === '/admin/packages'} />;
  else if (pathname === '/admin/matches/new') page = <CreateMatch />;
  else if (pathname === '/admin/matches') page = <MatchHistory />;
  else if (pathname.startsWith('/admin/matches/'))
    page = <HostMatch id={pathname.split('/').pop()!} />;
  else if (pathname === '/admin/characters') page = <CharacterGallery />;
  else if (pathname === '/admin/settings') page = <GameSettingsPage />;
  else if (pathname === '/admin/leaderboard') page = <Leaderboard />;
  else if (pathname === '/admin/account') page = <AdministratorSettings />;
  else page = <Dashboard username={user.username} />;
  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${mobile ? 'open' : ''}`}>
        <Link href="/" className="admin-brand">
          <span className="brand-symbol">
            <Activity size={24} />
          </span>
          <span>
            MEDICAL<span className="brand-sub">TUG OF WAR</span>
          </span>
        </Link>
        <button
          className="sidebar-close icon-btn"
          onClick={() => setMobile(false)}
          aria-label="Tutup menu"
        >
          <X size={20} />
        </button>
        <div className="sidebar-section">RUANG KONTROL</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`admin-nav-link ${pathname === n.href ? 'active' : ''}`}
            >
              <n.icon size={19} />
              {n.title}
              {pathname === n.href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <span className="help-icon">
            <CircleHelp size={21} />
          </span>
          <strong>Siap untuk bertanding?</strong>
          <p>
            Enam pemain. Dua tim.
            <br />
            Satu semangat untuk belajar.
          </p>
          <Link href="/admin/matches/new">
            Buat pertandingan <ArrowUpRight size={15} />
          </Link>
        </div>
        <Link href="/admin/account" className="admin-nav-link">
          <ShieldCheck size={18} />
          Akun administrator
        </Link>
        <button
          className="admin-nav-link logout"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            getSocket().disconnect();
            router.push('/admin/login');
          }}
        >
          <LogOut size={18} />
          Keluar
        </button>
        <div className="sidebar-footer">
          MEDICAL TUG OF WAR <span>v1.0</span>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Tutup menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Buka menu"
            >
              <Menu size={21} />
            </button>
            <span>Ruang kontrol</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className="platform-status">
              <span />
              Sistem aktif
            </span>
            <Link href="/join" className="join-header">
              Gabung sebagai pemain
              <ArrowUpRight size={14} />
            </Link>
            <Link href="/admin/account" className="admin-user">
              <span className="user-avatar">{user.username[0].toUpperCase()}</span>
              <span>
                <strong>{user.username}</strong>
                <small>Administrator</small>
              </span>
            </Link>
          </div>
        </header>
        <main className="admin-content">{page}</main>
        <footer className="admin-bottom">
          <span>Healthcare Heroes Quiz Battle</span>
          <span>
            Belajar bersama. Menang bersama. <Activity size={13} />
          </span>
        </footer>
      </div>
    </div>
  );
}

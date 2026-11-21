'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Clock3,
  Gamepad2,
  Plus,
  Radio,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { DashboardData, RoomState } from '@shared/index';
import { api } from '../../lib/api';
import { ErrorNotice, errorText, Loading, SectionHeading } from './AdminCommon';
const Arena = dynamic(() => import('../arena/Arena'), {
  ssr: false,
  loading: () => (
    <div className="arena-loading">
      <span className="spinner" /> Memuat arena 3D…
    </div>
  ),
});
export function PhaseBadge({ room }: { room: RoomState }) {
  return (
    <span className={`badge ${room.phase === 'FINISHED' ? 'badge-blue' : 'badge-green'}`}>
      <span className="tiny-dot" />
      {room.phase === 'FINISHED'
        ? 'Selesai'
        : ['WAITING', 'READY'].includes(room.phase)
          ? 'Lobby'
          : room.paused
            ? 'Dijeda'
            : 'Berlangsung'}
    </span>
  );
}
export function MatchList({ matches }: { matches: RoomState[] }) {
  return matches.length ? (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>PERTANDINGAN</th>
            <th>PAKET SOAL</th>
            <th>PEMAIN</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td>
                <Link href={`/admin/matches/${m.id}`} className="match-name">
                  <span className={`match-list-icon ${m.phase === 'FINISHED' ? 'completed' : ''}`}>
                    <Swords size={19} />
                  </span>
                  <span>
                    <strong>{m.title}</strong>
                    <small>
                      {new Date(m.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {m.code}
                    </small>
                  </span>
                </Link>
              </td>
              <td>{m.packageName}</td>
              <td>
                <Users size={14} className="inline-icon" /> {m.players.length}/6
              </td>
              <td>
                <PhaseBadge room={m} />
              </td>
              <td>
                <Link
                  href={`/admin/matches/${m.id}`}
                  className="icon-btn"
                  aria-label={`Buka ${m.title}`}
                >
                  <ChevronRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">
      <Swords size={34} />
      <h3>Arena menanti pertandingan pertama</h3>
      <p>Buat room dan undang enam pahlawan kesehatan Anda.</p>
      <Link href="/admin/matches/new" className="btn btn-primary btn-small">
        <Plus size={15} />
        Buat pertandingan
      </Link>
    </div>
  );
}
export default function Dashboard({ username }: { username: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<DashboardData>('/dashboard')
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => setError(errorText(e)));
    return () => {
      active = false;
    };
  }, []);
  const active = data?.matches.find((m) => m.phase !== 'FINISHED');
  return (
    <>
      <SectionHeading
        title={`Selamat datang, ${username} 👋`}
        description="Hari yang baik untuk belajar dan bertanding bersama tim."
        action={
          <Link href="/admin/matches/new" className="btn btn-primary">
            <Plus size={18} />
            Pertandingan baru
          </Link>
        }
      />
      <ErrorNotice error={error} />
      <div className="dashboard-stat-grid">
        {[
          {
            label: 'Total pertandingan',
            value: data?.totalMatches,
            icon: Swords,
            tone: 'emerald',
            note: 'Seluruh pertandingan',
          },
          {
            label: 'Pemain bergabung',
            value: data?.totalPlayers,
            icon: Users,
            tone: 'blue',
            note: 'Pahlawan di dalam arena',
          },
          {
            label: 'Bank pertanyaan',
            value: data?.totalQuestions,
            icon: BookOpen,
            tone: 'amber',
            note: 'Siap untuk dipertandingkan',
          },
          {
            label: 'Pertandingan aktif',
            value: data?.activeMatches,
            icon: Radio,
            tone: 'purple',
            note: `${data?.completedMatches ?? 0} pertandingan selesai`,
          },
        ].map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="stat-label">
              {s.label}
              <span className={`stat-icon ${s.tone}`}>
                <s.icon size={19} />
              </span>
            </div>
            <strong className="stat-value">{s.value ?? '—'}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <section className="card battle-feature">
          <div className="battle-feature-top">
            <span className="eyebrow">
              <span className="live-dot" /> ARENA PERTANDINGAN
            </span>
            <span className="badge">3D LIVE ARENA</span>
          </div>
          <div className="battle-feature-title">
            <div>
              <h2>Pengetahuan jadi kekuatan.</h2>
              <p>Tarik bersama. Buktikan hebatnya tim Anda.</p>
            </div>
            <span className="battle-medal">
              <Trophy size={25} />
            </span>
          </div>
          <div className="dashboard-arena">
            <div className="arena-team-label label-green">
              <span />
              TIM HIJAU<small>Healthcare heroes</small>
            </div>
            <div className="arena-team-label label-blue">
              <span />
              TIM BIRU<small>Healthcare heroes</small>
            </div>
            <Arena state={active} preview={!active} />
            <div className="arena-caption">
              HOSPITAL BATTLE <span>6 pahlawan · 2 tim · 1 kemenangan</span>
            </div>
          </div>
          <div className="battle-feature-bottom">
            <span>
              <span className="small-check">
                <CheckCircle2 size={16} />
              </span>
              {active
                ? `${active.title} · ${active.players.length}/6 pemain`
                : 'Arena siap. Pahlawan Anda berikutnya?'}
            </span>
            <Link
              className="btn btn-primary btn-small"
              href={active ? `/admin/matches/${active.id}` : '/admin/matches/new'}
            >
              {active ? 'Buka lobby' : 'Mulai pertandingan'}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <aside className="dashboard-side">
          <section className="card quick-start">
            <div className="section-card-title">
              <h3>Mulai petualangan</h3>
              <Zap size={18} />
            </div>
            <p className="muted">Tiga langkah menuju pertarungan pengetahuan.</p>
            {[
              {
                n: '01',
                title: 'Pilih paket soal',
                text: 'Siapkan tantangan untuk tim.',
                href: '/admin/packages',
                icon: BookOpen,
              },
              {
                n: '02',
                title: 'Undang enam pemain',
                text: 'Bagikan QR room ke peserta.',
                href: '/admin/matches/new',
                icon: Users,
              },
              {
                n: '03',
                title: 'BATTLE START!',
                text: 'Jawab benar, tarik lebih kuat.',
                href: '/admin/matches/new',
                icon: Swords,
              },
            ].map((item) => (
              <Link href={item.href} className="quick-step" key={item.n}>
                <span className="quick-step-number">{item.n}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))}
          </section>
          <Link href="/admin/characters" className="hero-collection">
            <div>
              <span className="eyebrow">KENALI TIM ANDA</span>
              <h3>
                Pahlawan dengan
                <br />
                kekuatan pengetahuan.
              </h3>
              <span>
                Lihat 8 karakter <ArrowUpRight size={15} />
              </span>
            </div>
            <div className="hero-collection-art">
              <ShieldSymbol />
            </div>
          </Link>
        </aside>
      </div>
      <section className="card recent-matches">
        <div className="section-card-title">
          <div>
            <h3>Pertandingan terbaru</h3>
            <p className="muted">Setiap pertarungan menyimpan cerita tim Anda.</p>
          </div>
          <Link href="/admin/matches" className="text-link">
            Lihat semua
            <ArrowRight size={16} />
          </Link>
        </div>
        {!data && !error ? <Loading /> : <MatchList matches={data?.matches.slice(0, 5) ?? []} />}
      </section>
      <div className="dashboard-tip">
        <span className="tip-star">✦</span>
        <span>
          <strong>Lebih dari sekadar menang.</strong> Setiap jawaban adalah langkah kecil menuju
          pelayanan kesehatan yang lebih baik.
        </span>
      </div>
    </>
  );
}
function ShieldSymbol() {
  return (
    <div className="mini-shield">
      <span>+</span>
      <Swords size={44} />
    </div>
  );
}

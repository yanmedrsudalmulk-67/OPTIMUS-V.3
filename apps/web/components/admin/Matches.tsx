'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Fullscreen,
  Gamepad2,
  Link2,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Square,
  Swords,
  Trophy,
  UnlockKeyhole,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CHARACTERS,
  DEFAULT_SETTINGS,
  type GameSettings,
  type QuestionPackage,
  type RoomState,
  type Team,
} from '@shared/index';
import { api } from '../../lib/api';
import { emit, getSocket } from '../../lib/socket';
import { ErrorNotice, errorText, Loading, SectionHeading } from './AdminCommon';
import { MatchList, PhaseBadge } from './Dashboard';
const Arena = dynamic(() => import('../arena/Arena'), {
  ssr: false,
  loading: () => (
    <div className="arena-loading">
      <span className="spinner" /> Memuat arena…
    </div>
  ),
});

export function CreateMatch() {
  const router = useRouter();
  const [packages, setPackages] = useState<QuestionPackage[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [packageId, setPackageId] = useState('');
  const [title, setTitle] = useState('');
  const [teamAName, setTeamAName] = useState('Tim Hijau');
  const [teamBName, setTeamBName] = useState('Tim Biru');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api<QuestionPackage[]>('/packages'), api<GameSettings>('/settings')])
      .then(([p, s]) => {
        setPackages(p);
        setSettings(s);
        setPackageId(p[0]?.id ?? '');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  const count =
    packages.find((p) => p.id === packageId)?.questions.filter((q) => q.active).length ?? 0;
  if (loading) return <Loading />;
  return (
    <>
      <SectionHeading
        eyebrow="SIAPKAN PERTARUNGAN"
        title="Pertandingan baru"
        description="Racik tantangan, pilih arena, dan kumpulkan tim terbaik Anda."
      />
      <form
        className="create-match-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const room = await api<RoomState>('/matches', {
              method: 'POST',
              body: JSON.stringify({ title, teamAName, teamBName, packageId, settings }),
            });
            router.push(`/admin/matches/${room.id}`);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="create-match-form">
          <section className="card form-section">
            <span className="section-number">01</span>
            <h3>Identitas pertandingan</h3>
            <p className="muted">Berikan nama untuk momen hebat tim Anda.</p>
            <label className="field">
              Nama pertandingan
              <input
                className="input"
                required
                maxLength={120}
                placeholder="Contoh: Battle Edukasi Keselamatan Pasien"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span className="team-input-label">
                  <span className="team-dot green" />
                  Nama Tim A
                </span>
                <input
                  className="input"
                  required
                  maxLength={40}
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="team-input-label">
                  <span className="team-dot blue" />
                  Nama Tim B
                </span>
                <input
                  className="input"
                  required
                  maxLength={40}
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="card form-section">
            <span className="section-number">02</span>
            <h3>Tantangan pengetahuan</h3>
            <p className="muted">Paket soal disalin sebagai snapshot saat room dibuat.</p>
            <label className="field">
              Paket soal
              <select
                className="select"
                aria-label="Paket soal"
                value={packageId}
                required
                onChange={(e) => setPackageId(e.target.value)}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.questions.filter((q) => q.active).length} soal)
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                Jumlah pertanyaan
                <input
                  type="number"
                  aria-label="Jumlah pertanyaan"
                  className="input"
                  min={1}
                  max={Math.max(count, 1)}
                  required
                  value={settings.questionCount}
                  onChange={(e) =>
                    setSettings({ ...settings, questionCount: Number(e.target.value) })
                  }
                />
                <small className="muted">Tersedia {count} soal aktif.</small>
              </label>
              <label className="field">
                Durasi menjawab (detik)
                <input
                  type="number"
                  aria-label="Durasi menjawab (detik)"
                  className="input"
                  min={0}
                  max={300}
                  required
                  value={settings.duration}
                  onChange={(e) => setSettings({ ...settings, duration: Number(e.target.value) })}
                />
                <small className="muted">Isi 0 untuk menggunakan durasi per soal.</small>
              </label>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.shuffle}
                onChange={(e) => setSettings({ ...settings, shuffle: e.target.checked })}
              />
              <span>
                <strong>Acak urutan soal</strong>
                <small>Urutan yang sama untuk seluruh pemain.</small>
              </span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.autoClose}
                onChange={(e) => setSettings({ ...settings, autoClose: e.target.checked })}
              />
              <span>
                <strong>Tutup otomatis setelah semua menjawab</strong>
                <small>Tanpa menunggu timer habis.</small>
              </span>
            </label>
          </section>
          <section className="card form-section">
            <span className="section-number">03</span>
            <h3>Pilih arena</h3>
            <div className="arena-choice-grid">
              {(
                [
                  {
                    id: 'hospital',
                    title: 'Hospital Battle',
                    text: 'Halaman rumah sakit yang cerah',
                    icon: ShieldCheck,
                  },
                  {
                    id: 'fantasy',
                    title: 'Fantasy Battlefield',
                    text: 'Padang petualangan penuh tantangan',
                    icon: Flag,
                  },
                ] as const
              ).map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={`arena-choice ${settings.arena === a.id ? 'selected' : ''}`}
                  onClick={() => setSettings({ ...settings, arena: a.id })}
                >
                  <a.icon size={28} />
                  <strong>{a.title}</strong>
                  <small>{a.text}</small>
                  <span className="choice-radio">
                    {settings.arena === a.id && <Check size={12} />}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <ErrorNotice error={error} />
          <div className="create-match-actions">
            <Link href="/admin/dashboard" className="btn btn-secondary">
              Batal
            </Link>
            <button className="btn btn-primary" disabled={busy || !count}>
              <Plus size={18} />
              {busy ? 'Membuat room…' : 'Buat room pertandingan'}
            </button>
          </div>
        </div>
        <aside className="card match-summary">
          <div className="summary-art">
            <Swords size={50} />
            <span className="summary-spark">✦</span>
          </div>
          <span className="eyebrow">RINGKASAN PERTANDINGAN</span>
          <h2>{title || 'Pertarungan berikutnya'}</h2>
          <div className="summary-teams">
            <span className="green">
              {teamAName}
              <small>3 pemain</small>
            </span>
            <b>VS</b>
            <span className="blue">
              {teamBName}
              <small>3 pemain</small>
            </span>
          </div>
          <dl>
            <div>
              <dt>Paket</dt>
              <dd>{packages.find((p) => p.id === packageId)?.name || 'Belum dipilih'}</dd>
            </div>
            <div>
              <dt>Pertanyaan</dt>
              <dd>{settings.questionCount} soal</dd>
            </div>
            <div>
              <dt>Durasi</dt>
              <dd>{settings.duration || 'Per soal'} detik</dd>
            </div>
            <div>
              <dt>Arena</dt>
              <dd>{settings.arena === 'hospital' ? 'Hospital Battle' : 'Fantasy Battlefield'}</dd>
            </div>
            <div>
              <dt>Power jawaban benar</dt>
              <dd>+{settings.baseCorrectPower}</dd>
            </div>
          </dl>
          <div className="summary-note">
            <QrCode size={21} />
            <p>Room code dan QR bergabung dibuat setelah pertandingan disimpan.</p>
          </div>
          <small className="muted">Pertandingan dimulai ketika 6 pemain terhubung dan siap.</small>
        </aside>
      </form>
    </>
  );
}

export function HostMatch({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [shareBase, setShareBase] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => {
    try {
      setRoom(await api<RoomState>(`/matches/${id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => {
    void load();
    setShareBase(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }, [load]);
  useEffect(() => {
    if (!room?.code) return;
    const code = room.code;
    const socket = getSocket();
    const update = (s: RoomState) => {
      if (s.code === code) {
        setRoom(s);
        setOffset(s.serverTime - Date.now());
      }
    };
    const watch = () => {
      setConnected(true);
      emit<RoomState>('room:watch', { code })
        .then(update)
        .catch((e) => setError(errorText(e)));
    };
    const offline = () => setConnected(false);
    socket.on('room:state', update);
    socket.on('connect', watch);
    socket.on('disconnect', offline);
    if (socket.connected) watch();
    return () => {
      socket.off('room:state', update);
      socket.off('connect', watch);
      socket.off('disconnect', offline);
    };
  }, [room?.code]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);
  const joinUrl = room ? `${shareBase.replace(/\/$/, '')}/join/${room.code}` : '';
  useEffect(() => {
    if (!joinUrl) return;
    let active = true;
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(joinUrl, {
          width: 280,
          margin: 2,
          color: { dark: '#173c35', light: '#ffffff' },
        }),
      )
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => setQr(''));
    return () => {
      active = false;
    };
  }, [joinUrl]);
  const action = async (event: string, payload: Record<string, unknown> = {}) => {
    if (!room) return;
    setBusy(true);
    setError('');
    try {
      await emit(event, { code: room.code, ...payload });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!room) return error ? <ErrorNotice error={error} /> : <Loading />;
  const waiting = ['WAITING', 'READY'].includes(room.phase);
  const ready = room.players.filter((p) => p.ready && p.connected).length;
  const teamsConnected = Boolean(room.teams?.A?.connected && room.teams?.B?.connected);
  const teamsReady = Boolean(room.teams?.A?.ready && room.teams?.B?.ready);
  const canStart = room.teams
    ? teamsConnected && teamsReady && room.teams.A.characters?.length === 3 && room.teams.B.characters?.length === 3
    : room.players.length === 6 &&
      ready === 6 &&
      ['A', 'B'].every((t) => room.players.filter((p) => p.team === t).length === 3);
  const seconds = room.deadlineAt
    ? Math.max(0, Math.ceil((room.deadlineAt - now - offset) / 1000))
    : 0;
  const winnerName =
    room.winner === 'A' ? room.teamAName : room.winner === 'B' ? room.teamBName : 'Kedua tim';
  return (
    <>
      <SectionHeading
        eyebrow={`ROOM ${room.code}`}
        title={room.title}
        description={`${room.packageName} · ${room.questionCount} pertanyaan`}
        action={
          <div className="heading-actions">
            <PhaseBadge room={room} />
            <Link href={`/display/${room.code}`} target="_blank" className="btn btn-secondary">
              <Fullscreen size={16} />
              Buka display
              <ExternalLink size={14} />
            </Link>
          </div>
        }
      />
      <ErrorNotice error={error} />
      <div className="host-status-strip">
        <span className={connected ? 'connected' : 'disconnected'}>
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}{' '}
          {connected ? 'Server terhubung' : 'Menyambungkan kembali…'}
        </span>
        <span>
          <Users size={15} />{' '}
          {room.teams
            ? `${(room.teams.A.connected ? 1 : 0) + (room.teams.B.connected ? 1 : 0)}/2 tim terhubung`
            : `${room.players.length}/6 pemain`}
        </span>
        <span>
          <CheckCircle2 size={15} />{' '}
          {room.teams
            ? `${(room.teams.A.ready ? 1 : 0) + (room.teams.B.ready ? 1 : 0)}/2 tim siap`
            : `${ready}/6 siap`}
        </span>
        <span>
          <Clock3 size={15} />
          {room.paused
            ? 'Timer dijeda'
            : room.deadlineAt
              ? `${seconds} detik`
              : 'Menunggu pertandingan'}
        </span>
      </div>
      <div className="host-grid">
        <div className="host-main">
          <section className="card host-arena-card">
            <div className="host-arena-top">
              <span className="team-chip green">
                {room.teamAName}
                <b>{room.teamAPower} POWER</b>
              </span>
              <span className="host-round">
                {waiting
                  ? 'LOBBY'
                  : room.phase === 'FINISHED'
                    ? 'FINISHED'
                    : `RONDE ${room.questionIndex + 1}/${room.questionCount}`}
                <small>{room.paused ? 'DIJEDA' : room.phase.replaceAll('_', ' ')}</small>
              </span>
              <span className="team-chip blue">
                {room.teamBName}
                <b>{room.teamBPower} POWER</b>
              </span>
            </div>
            <div className="host-arena">
              <Arena state={room} theme={room.settings.arena} />
              {room.phase === 'COUNTDOWN' && (
                <div className="host-countdown">{seconds || 'BATTLE!'}</div>
              )}
              {room.paused && (
                <div className="paused-overlay">
                  <Pause size={32} />
                  <strong>Pertandingan dijeda</strong>
                  <span>Timer berhenti di server.</span>
                </div>
              )}
            </div>
            <div className="power-balance">
              <span>{room.teamAName}</span>
              <div className="power-track">
                <span className="power-center" />
                <span
                  className="power-marker"
                  style={{ left: `${50 + (room.ropePosition / room.settings.winThreshold) * 48}%` }}
                />
              </div>
              <span>{room.teamBName}</span>
            </div>
          </section>
          {room.question && (
            <section className="card host-question">
              <div className="section-card-title">
                <span className="eyebrow">PERTANYAAN {room.questionIndex + 1}</span>
                <span className="badge">
                  {room.players.filter((p) => p.answered).length}/6 menjawab
                </span>
              </div>
              {room.question.imageUrl && (
                <img
                  className="question-preview-image"
                  alt="Ilustrasi pertanyaan"
                  src={room.question.imageUrl}
                />
              )}
              <h2>{room.question.text}</h2>
              <div className="host-answer-options">
                {room.question.options.map((o, i) => (
                  <div className={room.correctAnswer === i ? 'correct' : ''} key={i}>
                    <b>{String.fromCharCode(65 + i)}</b>
                    {o}
                    {room.correctAnswer === i && <CheckCircle2 size={18} />}
                  </div>
                ))}
              </div>
              {room.explanation && (
                <div className="answer-explanation">
                  <strong>Penjelasan</strong>
                  <p>{room.explanation}</p>
                </div>
              )}
            </section>
          )}
          {room.phase === 'FINISHED' && (
            <section className="card match-result">
              <Trophy size={42} />
              <span className="eyebrow">
                {room.winner === 'DRAW' ? 'POWER BALANCED!' : 'VICTORY!'}
              </span>
              <h2>
                {room.winner === 'DRAW'
                  ? 'Pertandingan berakhir imbang'
                  : `${winnerName} memenangkan pertandingan!`}
              </h2>
              <p className="muted">Hasil, jawaban, dan kontribusi pemain tersimpan di database.</p>
              <div className="result-stats">
                <span>
                  <strong>{room.rounds.length}</strong>Ronde selesai
                </span>
                <span>
                  <strong>{room.ropePosition.toFixed(1)}</strong>Posisi tali akhir
                </span>
                <span>
                  <strong>{room.players.reduce((n, p) => n + p.correctCount, 0)}</strong>Jawaban
                  benar
                </span>
              </div>
            </section>
          )}
          <section className="team-lobby-grid">
            {(['A', 'B'] as Team[]).map((team) => (
              <div className={`card team-lobby team-${team}`} key={team}>
                <div className="team-lobby-title">
                  <h3>
                    <span className={`team-dot ${team === 'A' ? 'green' : 'blue'}`} />
                    {team === 'A' ? room.teamAName : room.teamBName}
                  </h3>
                  <span>{room.players.filter((p) => p.team === team).length}/3</span>
                </div>
                {Array.from({ length: 3 }, (_, i) => {
                  const p = room.players.filter((p) => p.team === team)[i];
                  return p ? (
                    <div className="lobby-player" key={p.id}>
                      <div
                        className="lobby-avatar"
                        style={{
                          background: CHARACTERS.find((c) => c.id === p.characterId)?.color,
                        }}
                      >
                        {p.name[0].toUpperCase()}
                        <span className={p.connected ? 'online' : 'offline'} />
                      </div>
                      <div className="lobby-player-name">
                        <strong>{p.name}</strong>
                        <small>
                          {CHARACTERS.find((c) => c.id === p.characterId)?.profession ??
                            p.characterId}
                        </small>
                      </div>
                      <span className={`badge ${p.ready ? 'badge-green' : ''}`}>
                        {room.phase === 'FINISHED'
                          ? `${p.score} poin`
                          : p.ready
                            ? 'READY'
                            : 'Belum siap'}
                      </span>
                      {waiting && (
                        <div className="player-controls">
                          <button
                            className="icon-btn"
                            disabled={
                              busy || room.players.filter((o) => o.team !== team).length >= 3
                            }
                            title="Pindah tim"
                            aria-label={`Pindahkan ${p.name}`}
                            onClick={() =>
                              void action('host:move-player', {
                                playerId: p.id,
                                team: team === 'A' ? 'B' : 'A',
                              })
                            }
                          >
                            <ArrowRightLeft size={14} />
                          </button>
                          <button
                            className="icon-btn danger"
                            disabled={busy}
                            aria-label={`Keluarkan ${p.name}`}
                            onClick={() => {
                              if (confirm(`Keluarkan ${p.name} dari room?`))
                                void action('host:kick-player', { playerId: p.id });
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="lobby-empty" key={i}>
                      <span>
                        <Plus size={18} />
                      </span>
                      <div>
                        <strong>Menunggu pahlawan</strong>
                        <small>Slot pemain {i + 1}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
          {room.rounds.length > 0 && (
            <section className="card round-history">
              <div className="section-card-title">
                <h3>Hasil setiap tarikan</h3>
                <span className="badge">{room.rounds.length} ronde</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>RONDE</th>
                      <th>{room.teamAName}</th>
                      <th>{room.teamBName}</th>
                      <th>POSISI TALI</th>
                      <th>KUNCI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.rounds.map((r, i) => (
                      <tr key={i}>
                        <td>Ronde {r.questionIndex + 1}</td>
                        <td>{r.teamAPower} power</td>
                        <td>{r.teamBPower} power</td>
                        <td>{r.ropeAfter.toFixed(1)}</td>
                        <td>{String.fromCharCode(65 + r.correctAnswer)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        <aside className="host-sidebar">
          <section className="card room-share">
            <div className="section-card-title">
              <h3>Undang pahlawan</h3>
              <QrCode size={20} />
            </div>
            <p className="muted">Pindai QR lewat smartphone untuk bergabung.</p>
            <div className="room-qr">
              {qr ? (
                <img src={qr} alt={`QR bergabung ke room ${room.code}`} />
              ) : (
                <QrCode size={90} />
              )}
            </div>
            <span className="eyebrow">KODE ROOM</span>
            <div className="room-code">{room.code}</div>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError('Salin tautan secara manual dari kolom di bawah.');
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
              {copied ? 'Tautan tersalin' : 'Salin tautan bergabung'}
            </button>
            <label className="field share-base">
              Alamat server yang dapat diakses HP
              <input
                className="input"
                type="url"
                value={shareBase}
                onChange={(e) => setShareBase(e.target.value)}
              />
            </label>
            {/localhost|127\.0\.0\.1/.test(shareBase) && (
              <p className="share-warning">
                Untuk HP lain, ganti alamat ini dengan IP LAN komputer atau domain HTTPS. Perubahan
                ini memperbarui QR.
              </p>
            )}
            <a className="room-url" href={joinUrl} target="_blank" rel="noreferrer">
              {joinUrl}
              <ExternalLink size={12} />
            </a>
          </section>
          <section className="card host-controls">
            <div className="section-card-title">
              <h3>Kontrol pertandingan</h3>
              <Gamepad2 size={19} />
            </div>
            {waiting ? (
              <>
                <button
                  className="btn btn-primary start-battle"
                  disabled={busy || !canStart || !connected}
                  onClick={() => void action('host:start-match')}
                >
                  <Play size={18} />
                  START BATTLE
                </button>
                <p className="muted">
                  {canStart
                    ? 'Kedua tim sudah siap! Klik tombol START BATTLE untuk memulai pertandingan.'
                    : room.teams
                      ? !teamsConnected
                        ? 'Menunggu kedua tim terhubung...'
                        : !teamsReady
                          ? 'Menunggu kedua tim menekan tombol READY...'
                          : 'Menunggu kedua tim memilih 3 pahlawan.'
                      : `Menunggu ${6 - ready} pemain siap dan terhubung.`}
                </p>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void action('host:lock-lobby', { locked: !room.locked })}
                >
                  {room.locked ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}{' '}
                  {room.locked ? 'Buka kunci lobby' : 'Kunci lobby'}
                </button>
              </>
            ) : room.phase !== 'FINISHED' ? (
              <>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void action(room.paused ? 'host:resume-match' : 'host:pause-match')
                  }
                >
                  {room.paused ? <Play size={18} /> : <Pause size={18} />}{' '}
                  {room.paused ? 'Lanjutkan pertandingan' : 'Jeda pertandingan'}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busy || room.paused}
                  onClick={() => void action('host:next-question')}
                >
                  <SkipForward size={16} />
                  Lanjutkan fase
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Akhiri pertandingan sekarang? Hasil saat ini akan disimpan.'))
                      void action('host:end-match');
                  }}
                >
                  <Square size={15} />
                  Akhiri pertandingan
                </button>
              </>
            ) : (
              <>
                <Link href="/admin/matches/new" className="btn btn-primary">
                  <Plus size={17} />
                  Pertandingan baru
                </Link>
                <Link href="/admin/matches" className="btn btn-secondary">
                  Lihat riwayat
                </Link>
              </>
            )}
            <button
              className="reset-match"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'Reset pertandingan? Skor, jawaban, dan progres pertandingan ini akan dikosongkan.',
                  )
                )
                  void action('host:reset-match');
              }}
            >
              <RotateCcw size={14} />
              Reset pertandingan
            </button>
          </section>
          <div className="host-integrity">
            <ShieldCheck size={21} />
            <div>
              <strong>Server-authoritative</strong>
              <p>Waktu, jawaban, kekuatan, dan pemenang dihitung oleh server.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function MatchHistory() {
  const [matches, setMatches] = useState<RoomState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('all');
  useEffect(() => {
    api<RoomState[]>('/matches')
      .then(setMatches)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  const filtered = matches.filter(
    (m) =>
      (!date || m.createdAt.slice(0, 10) === date) &&
      (status === 'all' ||
        (status === 'finished' ? m.phase === 'FINISHED' : m.phase !== 'FINISHED')),
  );
  return (
    <>
      <SectionHeading
        eyebrow="JEJAK PARA PAHLAWAN"
        title="Riwayat pertandingan"
        description="Semua perjuangan, jawaban, dan kemenangan tersimpan di sini."
        action={
          <Link className="btn btn-primary" href="/admin/matches/new">
            <Plus size={17} />
            Pertandingan baru
          </Link>
        }
      />
      <ErrorNotice error={error} />
      <section className="card">
        <div className="history-filters">
          <label className="field">
            Tanggal
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            Status
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Semua status</option>
              <option value="active">Aktif / lobby</option>
              <option value="finished">Selesai</option>
            </select>
          </label>
          <button
            className="text-link"
            onClick={() => {
              setDate('');
              setStatus('all');
            }}
          >
            Reset filter
          </button>
          <span className="muted">{filtered.length} pertandingan</span>
        </div>
        {loading ? <Loading /> : <MatchList matches={filtered} />}
      </section>
    </>
  );
}

type Leader = {
  id: string;
  name: string;
  team: string;
  score: number;
  correctCount: number;
  power: number;
  matches: number;
};
export function Leaderboard() {
  const [data, setData] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Leader[]>('/leaderboard')
      .then(setData)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <SectionHeading
        eyebrow="HALL OF HEROES"
        title="Papan peringkat"
        description="Apresiasi untuk pengetahuan, kontribusi, dan semangat bertanding."
      />
      <ErrorNotice error={error} />
      <div className="leaderboard-banner">
        <div>
          <span className="eyebrow">SETIAP JAWABAN BERARTI</span>
          <h2>Pahlawan hebat membangun tim kuat.</h2>
          <p>Peringkat berdasarkan poin yang diperoleh dari pertandingan tersimpan.</p>
        </div>
        <Trophy size={70} />
      </div>
      <section className="card">
        {loading ? (
          <Loading />
        ) : data.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PERINGKAT</th>
                  <th>PAHLAWAN</th>
                  <th>POIN</th>
                  <th>JAWABAN BENAR</th>
                  <th>KONTRIBUSI</th>
                  <th>PERTANDINGAN</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <span className={`rank-badge rank-${i + 1}`}>
                        {i < 3 ? <Trophy size={17} /> : i + 1}
                      </span>
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                      <small className="leader-id">ID {p.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      <strong>{p.score}</strong>
                    </td>
                    <td>{p.correctCount}</td>
                    <td>{p.power} power</td>
                    <td>{p.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Trophy size={36} />
            <h3>Panggung para juara masih terbuka</h3>
            <p>Selesaikan pertandingan untuk melihat peringkat pemain.</p>
          </div>
        )}
      </section>
      <p className="muted leaderboard-note">
        Identitas pemain menggunakan ID sesi; nama yang sama tidak digabung menjadi satu pemain.
      </p>
    </>
  );
}

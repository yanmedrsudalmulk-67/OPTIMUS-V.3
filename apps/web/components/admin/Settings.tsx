'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Gamepad2,
  LockKeyhole,
  Music2,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Volume2,
  Zap,
} from 'lucide-react';
import { CHARACTERS, DEFAULT_SETTINGS, type GameSettings } from '@shared/index';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { ErrorNotice, errorText, Loading, SectionHeading } from './AdminCommon';
const CharacterPreview = dynamic(() => import('../arena/CharacterPreview'), {
  ssr: false,
  loading: () => (
    <div className="arena-loading">
      <span className="spinner" /> Memuat karakter…
    </div>
  ),
});

export function CharacterGallery() {
  const [index, setIndex] = useState(0);
  const [team, setTeam] = useState<'A' | 'B'>('A');
  const character = CHARACTERS[index];
  return (
    <>
      <SectionHeading
        eyebrow="MEET YOUR HEALTHCARE HEROES"
        title="Galeri karakter"
        description="Delapan profesi. Beragam kepribadian. Satu semangat untuk menang."
      />
      <div className="character-gallery">
        <section className="card character-preview-card">
          <div className="character-preview-header">
            <span className="badge badge-green">
              KARAKTER {String(index + 1).padStart(2, '0')} / 08
            </span>
            <span className="eyebrow">3D CHARACTER</span>
          </div>
          <div className="gallery-character-view">
            <CharacterPreview characterId={character.id} team={team} />
            <div className="character-platform" />
          </div>
          <div className="character-preview-nav">
            <button
              className="icon-btn"
              onClick={() => setIndex((index + 7) % 8)}
              aria-label="Karakter sebelumnya"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="eyebrow">{character.profession}</span>
              <h2>{character.name}</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setIndex((index + 1) % 8)}
              aria-label="Karakter selanjutnya"
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <p className="muted">{character.description}</p>
          <div className="team-preview-toggle">
            <button className={team === 'A' ? 'selected green' : ''} onClick={() => setTeam('A')}>
              <span className="team-dot green" />
              Tim Hijau
            </button>
            <button className={team === 'B' ? 'selected blue' : ''} onClick={() => setTeam('B')}>
              <span className="team-dot blue" />
              Tim Biru
            </button>
          </div>
          <span className="character-drag-hint">Geser untuk memutar karakter 3D</span>
        </section>
        <section className="character-selection">
          <div className="section-card-title">
            <h3>Pilih pahlawan Anda</h3>
            <span className="badge">8 profesi</span>
          </div>
          <div className="character-grid">
            {CHARACTERS.map((c, i) => (
              <button
                key={c.id}
                className={`character-select-card ${index === i ? 'selected' : ''}`}
                onClick={() => setIndex(i)}
                style={{ '--character-color': c.color } as React.CSSProperties}
              >
                <span className="character-select-number">0{i + 1}</span>
                <span className="character-select-symbol">
                  <ShieldCheck size={34} />
                  <i>+</i>
                </span>
                <strong>{c.name}</strong>
                <small>{c.profession}</small>
                {index === i && (
                  <span className="character-selected-check">
                    <Check size={13} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="character-gallery-note">
            <Sparkles size={21} />
            <p>
              Model 3D prosedural orisinal dengan animasi sendi. Aset GLB profesional dapat
              ditambahkan melalui sistem model karakter.
            </p>
          </div>
          <div className="card character-profile">
            <span className="eyebrow">PROFIL PAHLAWAN</span>
            <h3>{character.profession}</h3>
            <p>{character.description}</p>
            <dl>
              <div>
                <dt>Keahlian utama</dt>
                <dd>Pengetahuan & kerja sama</dd>
              </div>
              <div>
                <dt>Power standar</dt>
                <dd>Sama untuk seluruh karakter</dd>
              </div>
              <div>
                <dt>Ketersediaan</dt>
                <dd>Semua pemain · semua tim</dd>
              </div>
            </dl>
            <p className="muted">
              Karakter adalah pilihan visual. Kemenangan ditentukan oleh jawaban tim, bukan profesi.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function NumberSetting({
  title,
  description,
  value,
  onChange,
  min = 0,
  max = 300,
  step = 1,
}: {
  title: string;
  description?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="setting-number">
      <div>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </div>
      <input
        className="input"
        type="number"
        aria-label={title}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        required
      />
    </label>
  );
}
function ToggleSetting({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="setting-toggle">
      <div>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </div>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span />
      </span>
    </label>
  );
}
export function GameSettingsPage() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api<GameSettings>('/settings')
      .then(setSettings)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  const change = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSaved(false);
    setSettings((s) => ({ ...s, [key]: value }));
  };
  if (loading) return <Loading />;
  return (
    <>
      <SectionHeading
        eyebrow="ATUR PENGALAMAN BERTANDING"
        title="Pengaturan game"
        description="Pengaturan ini menjadi nilai awal untuk pertandingan baru."
      />
      <ErrorNotice error={error} />
      {saved && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          Pengaturan tersimpan. Pertandingan aktif tetap menggunakan snapshot pengaturannya.
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setSaved(false);
          try {
            setSettings(
              await api<GameSettings>('/settings', {
                method: 'PUT',
                body: JSON.stringify(settings),
              }),
            );
            setSaved(true);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="settings-grid">
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon emerald">
                <Gamepad2 size={23} />
              </span>
              <div>
                <h3>Alur pertandingan</h3>
                <p>Tempo yang pas untuk semua pahlawan.</p>
              </div>
            </div>
            <NumberSetting
              title="Jumlah soal"
              value={settings.questionCount}
              min={1}
              max={100}
              onChange={(v) => change('questionCount', v)}
            />
            <NumberSetting
              title="Durasi jawaban"
              description="Detik; isi 0 untuk memakai durasi per soal."
              value={settings.duration}
              max={300}
              onChange={(v) => change('duration', v)}
            />
            <NumberSetting
              title="Countdown awal"
              description="Hitung mundur sebelum soal pertama."
              value={settings.countdownSeconds}
              min={1}
              max={10}
              onChange={(v) => change('countdownSeconds', v)}
            />
            <NumberSetting
              title="Pengungkapan jawaban"
              description="Durasi pemain membaca jawaban benar."
              value={settings.revealSeconds}
              min={1}
              max={30}
              onChange={(v) => change('revealSeconds', v)}
            />
            <NumberSetting
              title="Animasi tarikan"
              value={settings.pullSeconds}
              min={1}
              max={15}
              onChange={(v) => change('pullSeconds', v)}
            />
            <NumberSetting
              title="Hasil ronde"
              value={settings.resultSeconds}
              min={1}
              max={30}
              onChange={(v) => change('resultSeconds', v)}
            />
            <ToggleSetting
              title="Acak urutan soal"
              value={settings.shuffle}
              onChange={(v) => change('shuffle', v)}
            />
            <ToggleSetting
              title="Tutup soal otomatis"
              description="Lanjut ketika keenam pemain sudah menjawab."
              value={settings.autoClose}
              onChange={(v) => change('autoClose', v)}
            />
          </section>
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon amber">
                <Zap size={23} />
              </span>
              <div>
                <h3>Kekuatan & penilaian</h3>
                <p>Dihitung di server, konsisten untuk semua tim.</p>
              </div>
            </div>
            <NumberSetting
              title="Power jawaban benar"
              description="Jawaban salah / kosong mendapat 0 power."
              value={settings.baseCorrectPower}
              min={1}
              max={100}
              onChange={(v) => change('baseCorrectPower', v)}
            />
            <NumberSetting
              title="Pengali tarikan"
              description="Selisih power × pengali = pergeseran tali."
              value={settings.pullMultiplier}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(v) => change('pullMultiplier', v)}
            />
            <NumberSetting
              title="Batas kemenangan"
              description="Tim A: batas negatif. Tim B: batas positif."
              value={settings.winThreshold}
              min={10}
              max={1000}
              onChange={(v) => change('winThreshold', v)}
            />
            <ToggleSetting
              title="Bonus kecepatan"
              description="Bonus deterministik untuk jawaban benar lebih cepat."
              value={settings.speedBonus}
              onChange={(v) => change('speedBonus', v)}
            />
            <ToggleSetting
              title="Bonus combo"
              description="Bonus atas rangkaian jawaban benar."
              value={settings.comboBonus}
              onChange={(v) => change('comboBonus', v)}
            />
            <ToggleSetting
              title="Sudden death"
              description="Perpanjangan jika seri dan tersedia soal cadangan."
              value={settings.suddenDeath}
              onChange={(v) => change('suddenDeath', v)}
            />
            <div className="settings-formula">
              <span className="eyebrow">FORMULA TARIKAN</span>
              <code>Δ tali = (power B − power A) × {settings.pullMultiplier}</code>
              <p>
                Bonus nonaktif secara default. Poin individual mengikuti nilai yang diatur pada
                masing-masing soal.
              </p>
            </div>
          </section>
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon blue">
                <Eye size={23} />
              </span>
              <div>
                <h3>Visual & arena</h3>
                <p>Sesuaikan dengan perangkat dan layar.</p>
              </div>
            </div>
            <label className="field">
              Tema arena
              <select
                className="select"
                value={settings.arena}
                onChange={(e) => change('arena', e.target.value as GameSettings['arena'])}
              >
                <option value="hospital">Hospital Battle</option>
                <option value="fantasy">Fantasy Battlefield</option>
              </select>
            </label>
            <label className="field">
              Kualitas grafis
              <select
                className="select"
                value={settings.quality}
                onChange={(e) => change('quality', e.target.value as GameSettings['quality'])}
              >
                <option value="AUTO">AUTO — menyesuaikan perangkat</option>
                <option value="LOW">LOW — performa ringan</option>
                <option value="MEDIUM">MEDIUM — seimbang</option>
                <option value="HIGH">HIGH — detail lebih tinggi</option>
              </select>
            </label>
            <ToggleSetting
              title="Efek partikel"
              description="Debu dan konfeti pada arena."
              value={settings.particles}
              onChange={(v) => change('particles', v)}
            />
            <ToggleSetting
              title="Gerakan kamera"
              description="Gerakan ringan saat tarikan dan kemenangan."
              value={settings.cameraMotion}
              onChange={(v) => change('cameraMotion', v)}
            />
            <div className="settings-note">
              <ShieldCheck size={19} />
              <p>Pemain tetap dapat menjawab lewat HP jika perangkat tidak mendukung WebGL.</p>
            </div>
          </section>
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon purple">
                <Volume2 size={23} />
              </span>
              <div>
                <h3>Audio</h3>
                <p>Hidupkan suasana tanpa mengganggu fokus.</p>
              </div>
            </div>
            <ToggleSetting
              title="Efek suara"
              description="Countdown, jawaban, dan hasil pertandingan."
              value={settings.sound}
              onChange={(v) => change('sound', v)}
            />
            <ToggleSetting
              title="Musik latar"
              description="Musik prosedural orisinal, diaktifkan setelah interaksi."
              value={settings.music}
              onChange={(v) => change('music', v)}
            />
            <label className="field volume-setting">
              Volume <span>{Math.round(settings.volume * 100)}%</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => change('volume', Number(e.target.value))}
              />
            </label>
            <p className="muted">
              Browser membutuhkan interaksi pengguna sebelum audio dapat diputar. Permainan tetap
              berjalan tanpa audio.
            </p>
          </section>
        </div>
        <div className="settings-save-bar">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              if (
                confirm('Kembalikan formulir ke pengaturan bawaan? Simpan untuk menerapkannya.')
              ) {
                setSettings({ ...DEFAULT_SETTINGS });
                setSaved(false);
              }
            }}
          >
            <RotateCcw size={16} />
            Nilai bawaan
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Save size={17} />
            {busy ? 'Menyimpan…' : 'Simpan pengaturan'}
          </button>
        </div>
      </form>
    </>
  );
}

export function AdministratorSettings() {
  const [currentPassword, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  return (
    <>
      <SectionHeading
        eyebrow="KEAMANAN AKUN"
        title="Akun administrator"
        description="Jaga akses ruang kontrol tetap aman."
      />
      <section className="card admin-account-card">
        <span className="login-icon">
          <LockKeyhole size={27} />
        </span>
        <h2>Perbarui kata sandi</h2>
        <p className="muted">Gunakan kata sandi unik dengan minimal 10 karakter.</p>
        {success && (
          <div className="success-message">
            <CheckCircle2 size={18} />
            Kata sandi berhasil diperbarui. <a href="/admin/login">Masuk kembali</a> untuk
            melanjutkan.
          </div>
        )}
        <ErrorNotice error={error} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setSuccess(false);
            if (password !== confirmPassword) {
              setError('Konfirmasi kata sandi belum cocok.');
              return;
            }
            setBusy(true);
            try {
              await api('/auth/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, password }),
              });
              getSocket().disconnect();
              setSuccess(true);
              setCurrent('');
              setPassword('');
              setConfirm('');
              window.location.assign('/admin/login');
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Kata sandi saat ini
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="field">
            Kata sandi baru
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            Ulangi kata sandi baru
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={10}
              required
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            <ShieldCheck size={17} />
            {busy ? 'Memperbarui…' : 'Perbarui kata sandi'}
          </button>
        </form>
      </section>
    </>
  );
}

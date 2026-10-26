'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Question, QuestionPackage } from '@shared/index';
import { api } from '../../lib/api';
import { readQuestionRows } from '../../lib/spreadsheet';
import { ErrorNotice, errorText, Loading, SectionHeading } from './AdminCommon';

type QuestionDraft = Omit<Question, 'id'>;
const newQuestion = (packageId: string): QuestionDraft => ({
  packageId,
  text: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
  imageUrl: null,
  duration: 20,
  points: 10,
  active: true,
  sortOrder: 0,
});
type ImportResult = {
  valid: Question[];
  errors: { row: number; error: string }[];
  imported: number;
};

export default function QuestionManager({ packagesOnly = false }: { packagesOnly?: boolean }) {
  const [packages, setPackages] = useState<QuestionPackage[]>([]);
  const [selected, setSelected] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<(QuestionDraft & { id?: string }) | null>(null);
  const [preview, setPreview] = useState<QuestionDraft | null>(null);
  const [packageForm, setPackageForm] = useState<{
    id?: string;
    name: string;
    description: string;
  } | null>(null);
  const [importRows, setImportRows] = useState<Record<string, unknown>[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importName, setImportName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const p = await api<QuestionPackage[]>('/packages');
      setPackages(p);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const questions = packages
    .flatMap((p) => p.questions ?? [])
    .filter(
      (q) =>
        (selected === 'all' || q.packageId === selected) &&
        `${q.text} ${q.explanation}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const importFile = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran file maksimal 5 MB.');
      const rows = await readQuestionRows(file);
      if (!rows.length) throw new Error('File tidak berisi data pertanyaan.');
      if (rows.length > 1000) throw new Error('Maksimal 1.000 soal setiap impor.');
      setImportRows(rows);
      setImportName(file.name);
      setImportResult(
        await api<ImportResult>('/questions/import', {
          method: 'POST',
          body: JSON.stringify({ rows, commit: false }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  return (
    <>
      <SectionHeading
        eyebrow="KELOLA PENGETAHUAN"
        title={packagesOnly ? 'Paket soal' : 'Bank soal'}
        description={
          packagesOnly
            ? 'Susun paket tantangan yang relevan untuk setiap pertandingan.'
            : 'Pertanyaan terbaik untuk pahlawan kesehatan Anda.'
        }
        action={
          <div className="heading-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setPackageForm({ name: '', description: '' })}
            >
              <FolderOpen size={17} />
              Paket baru
            </button>
            {!packagesOnly && (
              <button
                className="btn btn-primary"
                disabled={!packages.length}
                onClick={() => {
                  const packageId = selected === 'all' ? packages[0]?.id : selected;
                  const qs = packages.find((p) => p.id === packageId)?.questions ?? [];
                  setEditing({
                    ...newQuestion(packageId),
                    sortOrder: qs.length ? Math.max(...qs.map((q) => q.sortOrder)) + 1 : 0,
                  });
                }}
              >
                <Plus size={17} />
                Tambah pertanyaan
              </button>
            )}
          </div>
        }
      />
      <ErrorNotice error={error} />
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx"
        className="visually-hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0]);
        }}
      />
      {loading ? (
        <Loading />
      ) : packagesOnly ? (
        <div className="package-card-grid">
          {packages.map((p, i) => (
            <div className="card package-card" key={p.id}>
              <div className={`package-card-icon package-tone-${i % 5}`}>
                <BookOpen size={27} />
                <span>0{i + 1}</span>
              </div>
              <div className="package-card-content">
                <span className="eyebrow">PAKET {i + 1}</span>
                <h3>{p.name}</h3>
                <p className="muted">{p.description || 'Tantangan pengetahuan untuk tim Anda.'}</p>
                <span className="badge badge-green">
                  {p.questions?.filter((q) => q.active).length ?? 0} soal aktif
                </span>
                <div className="package-card-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() =>
                      setPackageForm({ id: p.id, name: p.name, description: p.description })
                    }
                  >
                    <Edit3 size={14} />
                    Edit paket
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label={`Hapus paket ${p.name}`}
                    onClick={() => {
                      if (confirm(`Hapus paket "${p.name}" beserta seluruh soalnya?`))
                        void act(() => api(`/packages/${p.id}`, { method: 'DELETE' }));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            className="add-package-card"
            onClick={() => setPackageForm({ name: '', description: '' })}
          >
            <Plus size={30} />
            <strong>Racik tantangan baru</strong>
            <span>Buat paket soal Anda sendiri</span>
          </button>
        </div>
      ) : (
        <div className="question-workspace">
          <aside className="card package-sidebar">
            <div className="section-card-title">
              <h3>Semua paket</h3>
              <span className="badge">{packages.length}</span>
            </div>
            <button
              className={`package-filter ${selected === 'all' ? 'selected' : ''}`}
              onClick={() => setSelected('all')}
            >
              <BookOpen size={17} />
              <span>Semua pertanyaan</span>
              <b>{packages.reduce((n, p) => n + (p.questions?.length ?? 0), 0)}</b>
            </button>
            {packages.map((p, i) => (
              <button
                key={p.id}
                className={`package-filter ${selected === p.id ? 'selected' : ''}`}
                onClick={() => setSelected(p.id)}
              >
                <span className={`package-dot package-tone-${i % 5}`} />
                <span>{p.name}</span>
                <b>{p.questions?.length ?? 0}</b>
              </button>
            ))}
            <div className="package-sidebar-note">
              <FileSpreadsheet size={24} />
              <strong>Punya bank soal sendiri?</strong>
              <p>Impor Excel atau CSV dengan template yang tersedia.</p>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Impor pertanyaan
                <Upload size={14} />
              </button>
            </div>
          </aside>
          <section className="card question-list-card">
            <div className="question-toolbar">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Cari pertanyaan"
                  placeholder="Cari pertanyaan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="heading-actions">
                <button
                  className="btn btn-secondary btn-small"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={15} />
                  Impor
                </button>
                <a
                  className="btn btn-secondary btn-small"
                  href={`/api/questions/export?format=xlsx${selected !== 'all' ? `&packageId=${encodeURIComponent(selected)}` : ''}`}
                >
                  <Download size={15} />
                  Excel
                </a>
                <a
                  className="btn btn-secondary btn-small"
                  href={`/api/questions/export?format=csv${selected !== 'all' ? `&packageId=${encodeURIComponent(selected)}` : ''}`}
                >
                  CSV
                </a>
              </div>
            </div>
            <div className="question-count">
              <strong>{questions.length} pertanyaan</strong>
              <span className="muted">Klik edit untuk memperbarui soal dan kunci jawaban.</span>
            </div>
            {questions.length ? (
              <div className="question-list">
                {questions.map((q, i) => (
                  <article className="question-row" key={q.id}>
                    <div className="question-number">{String(i + 1).padStart(2, '0')}</div>
                    <div className="question-row-main">
                      <div className="question-row-meta">
                        <span>{packages.find((p) => p.id === q.packageId)?.name}</span>
                        <span>·</span>
                        <span>{q.duration} detik</span>
                        <span>·</span>
                        <span>{q.points} poin</span>
                      </div>
                      <h3>{q.text}</h3>
                      <div className="question-option-inline">
                        {q.options.map((o, j) => (
                          <span key={j} className={j === q.correctAnswer ? 'correct' : ''}>
                            {String.fromCharCode(65 + j)}. {o}
                            {j === q.correctAnswer && <Check size={12} />}
                          </span>
                        ))}
                      </div>
                      <div className="question-row-bottom">
                        <button
                          className={`status-toggle ${q.active ? 'active' : ''}`}
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              api(`/questions/${q.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ active: !q.active }),
                              }),
                            )
                          }
                        >
                          <span />
                          {q.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                        <span className="muted">Urutan {q.sortOrder + 1}</span>
                      </div>
                    </div>
                    <div className="question-row-actions">
                      <button
                        className="icon-btn"
                        aria-label="Pratinjau soal"
                        onClick={() => setPreview(q)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Edit soal"
                        onClick={() => setEditing({ ...q, options: [...q.options] })}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        disabled={busy}
                        aria-label="Gandakan soal"
                        onClick={() =>
                          void act(() => api(`/questions/${q.id}/duplicate`, { method: 'POST' }))
                        }
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        disabled={busy || i === 0 || questions[i - 1]?.packageId !== q.packageId}
                        aria-label="Pindahkan ke atas"
                        onClick={() =>
                          void act(async () => {
                            const prev = questions[i - 1];
                            await api(`/questions/${prev.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ sortOrder: q.sortOrder }),
                            });
                            await api(`/questions/${q.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ sortOrder: prev.sortOrder }),
                            });
                          })
                        }
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        disabled={
                          busy ||
                          i === questions.length - 1 ||
                          questions[i + 1]?.packageId !== q.packageId
                        }
                        aria-label="Pindahkan ke bawah"
                        onClick={() =>
                          void act(async () => {
                            const next = questions[i + 1];
                            await api(`/questions/${next.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ sortOrder: q.sortOrder }),
                            });
                            await api(`/questions/${q.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ sortOrder: next.sortOrder }),
                            });
                          })
                        }
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        disabled={busy}
                        aria-label="Hapus soal"
                        onClick={() => {
                          if (confirm('Hapus pertanyaan ini secara permanen?'))
                            void act(() => api(`/questions/${q.id}`, { method: 'DELETE' }));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={34} />
                <h3>Belum ada pertanyaan</h3>
                <p>Tambahkan soal atau impor dari file Excel / CSV.</p>
              </div>
            )}
            <div className="question-table-footer">
              <a className="text-link" href="/api/questions/template?format=xlsx">
                <Download size={14} />
                Template Excel
              </a>
              <a className="text-link" href="/api/questions/template?format=csv">
                Template CSV
              </a>
              <span className="muted">Kunci jawaban hanya ditampilkan kepada admin.</span>
            </div>
          </section>
        </div>
      )}
      {packageForm && (
        <div className="modal-backdrop" onClick={() => setPackageForm(null)}>
          <form
            className="modal admin-modal-small"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(() =>
                  api(packageForm.id ? `/packages/${packageForm.id}` : '/packages', {
                    method: packageForm.id ? 'PATCH' : 'POST',
                    body: JSON.stringify(packageForm),
                  }),
                )
              )
                setPackageForm(null);
            }}
          >
            <div className="modal-title">
              <h2>{packageForm.id ? 'Edit paket soal' : 'Paket soal baru'}</h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setPackageForm(null)}
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            <label className="field">
              Nama paket
              <input
                className="input"
                required
                maxLength={150}
                value={packageForm.name}
                onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
              />
            </label>
            <label className="field">
              Deskripsi
              <textarea
                className="input"
                rows={3}
                value={packageForm.description}
                onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
              />
            </label>
            <ErrorNotice error={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPackageForm(null)}
              >
                Batal
              </button>
              <button className="btn btn-primary" disabled={busy}>
                Simpan paket
              </button>
            </div>
          </form>
        </div>
      )}
      {editing && (
        <QuestionEditor
          draft={editing}
          packages={packages}
          busy={busy}
          error={error}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onPreview={() => setPreview(editing)}
          onSave={async () => {
            const payload = { ...editing };
            if (
              await act(() =>
                api(editing.id ? `/questions/${editing.id}` : '/questions', {
                  method: editing.id ? 'PATCH' : 'POST',
                  body: JSON.stringify(payload),
                }),
              )
            )
              setEditing(null);
          }}
        />
      )}
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <span className="eyebrow">PRATINJAU PERTANYAAN</span>
              <button
                className="icon-btn"
                aria-label="Tutup pratinjau"
                onClick={() => setPreview(null)}
              >
                <X size={20} />
              </button>
            </div>
            <span className="badge badge-green">
              {preview.duration} detik · {preview.points} poin
            </span>
            {preview.imageUrl && (
              <img
                className="question-preview-image"
                src={preview.imageUrl}
                alt="Ilustrasi pertanyaan"
              />
            )}
            <h2>{preview.text || 'Teks pertanyaan'}</h2>
            <div className="preview-options">
              {preview.options.map((o, i) => (
                <div key={i} className={i === preview.correctAnswer ? 'correct' : ''}>
                  <b>{String.fromCharCode(65 + i)}</b>
                  {o || `Pilihan ${i + 1}`}
                  {i === preview.correctAnswer && <CheckCircle2 size={18} />}
                </div>
              ))}
            </div>
            <div className="answer-explanation">
              <strong>Penjelasan jawaban</strong>
              <p>{preview.explanation || 'Belum ada penjelasan.'}</p>
            </div>
            <p className="muted">
              Kunci jawaban disembunyikan dari pemain sampai fase pengungkapan.
            </p>
          </div>
        </div>
      )}
      {importRows && (
        <div className="modal-backdrop">
          <div className="modal import-modal">
            <div className="modal-title">
              <div>
                <span className="eyebrow">VALIDASI SEBELUM DISIMPAN</span>
                <h2>Pratinjau impor soal</h2>
              </div>
              <button
                className="icon-btn"
                aria-label="Tutup impor"
                onClick={() => {
                  setImportRows(null);
                  setImportResult(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              {importName} · {importRows.length} baris data
            </p>
            <ErrorNotice error={error} />
            {importResult ? (
              <>
                <div className="import-summary">
                  <span className="badge badge-green">{importResult.valid.length} baris valid</span>
                  <span
                    className={`badge ${importResult.errors.length ? 'import-errors' : 'badge-green'}`}
                  >
                    {importResult.errors.length} kesalahan
                  </span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="import-error-list">
                    {importResult.errors.map((e, i) => (
                      <p key={i}>
                        <strong>Baris {e.row}</strong> — {e.error}
                      </p>
                    ))}
                  </div>
                )}
                <div className="import-preview-list">
                  {importResult.valid.slice(0, 15).map((q, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <p>{q.text}</p>
                      <small>{q.options?.[q.correctAnswer]}</small>
                    </div>
                  ))}
                </div>
                {importResult.valid.length > 15 && (
                  <p className="muted">Dan {importResult.valid.length - 15} pertanyaan lainnya.</p>
                )}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setImportRows(null)}>
                    Batal
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !!importResult.errors.length || !importResult.valid.length}
                    onClick={async () => {
                      if (
                        await act(() =>
                          api('/questions/import', {
                            method: 'POST',
                            body: JSON.stringify({ rows: importRows, commit: true }),
                          }),
                        )
                      ) {
                        setImportRows(null);
                        setImportResult(null);
                      }
                    }}
                  >
                    <Upload size={17} />
                    Impor {importResult.valid.length} pertanyaan
                  </button>
                </div>
              </>
            ) : (
              <Loading />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QuestionEditor({
  draft,
  packages,
  busy,
  error,
  onChange,
  onClose,
  onPreview,
  onSave,
}: {
  draft: QuestionDraft & { id?: string };
  packages: QuestionPackage[];
  busy: boolean;
  error: string;
  onChange: (v: QuestionDraft & { id?: string }) => void;
  onClose: () => void;
  onPreview: () => void;
  onSave: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  return (
    <div className="modal-backdrop">
      <form
        className="modal question-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">QUESTION MANAGER</span>
            <h2>{draft.id ? 'Edit pertanyaan' : 'Pertanyaan baru'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup editor">
            <X size={20} />
          </button>
        </div>
        <ErrorNotice error={error || uploadError} />
        <div className="form-grid">
          <label className="field">
            Paket soal
            <select
              className="select"
              aria-label="Paket soal"
              value={draft.packageId}
              onChange={(e) => onChange({ ...draft, packageId: e.target.value })}
            >
              {packages.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select
              className="select"
              aria-label="Status"
              value={String(draft.active)}
              onChange={(e) => onChange({ ...draft, active: e.target.value === 'true' })}
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </label>
        </div>
        <label className="field">
          Pertanyaan
          <textarea
            className="input"
            required
            minLength={5}
            rows={3}
            value={draft.text}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
            placeholder="Tulis pertanyaan yang jelas dan mudah dipahami…"
          />
        </label>
        <div className="form-grid">
          {draft.options.map((o, i) => (
            <label className="field" key={i}>
              Pilihan {String.fromCharCode(65 + i)}
              <input
                className="input"
                required
                value={o}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    options: draft.options.map((v, j) => (i === j ? e.target.value : v)),
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label className="field">
            Kunci jawaban
            <select
              className="select"
              aria-label="Kunci jawaban"
              value={draft.correctAnswer}
              onChange={(e) => onChange({ ...draft, correctAnswer: Number(e.target.value) })}
            >
              {draft.options.map((_, i) => (
                <option value={i} key={i}>
                  {String.fromCharCode(65 + i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Durasi (detik)
            <input
              className="input"
              type="number"
              required
              min={3}
              max={300}
              value={draft.duration}
              onChange={(e) => onChange({ ...draft, duration: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Poin jawaban benar
            <input
              className="input"
              type="number"
              required
              min={1}
              max={1000}
              value={draft.points}
              onChange={(e) => onChange({ ...draft, points: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Urutan pertanyaan
            <input
              className="input"
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => onChange({ ...draft, sortOrder: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="field">
          Penjelasan jawaban
          <textarea
            className="input"
            rows={2}
            value={draft.explanation}
            onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
          />
        </label>
        <label className="question-upload">
          <ImagePlus size={23} />
          <span>
            <strong>
              {uploading
                ? 'Mengunggah gambar…'
                : draft.imageUrl
                  ? 'Ganti gambar pertanyaan'
                  : 'Tambahkan gambar (opsional)'}
            </strong>
            <small>JPG, PNG, atau WebP · maksimal 3 MB</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploadError('');
              if (f.size > 3 * 1024 * 1024) {
                setUploadError('Gambar maksimal 3 MB.');
                return;
              }
              const data = new FormData();
              data.append('image', f);
              setUploading(true);
              try {
                const result = await api<{ url: string }>('/uploads', {
                  method: 'POST',
                  body: data,
                });
                onChange({ ...draft, imageUrl: result.url });
              } catch (err) {
                setUploadError(errorText(err));
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {draft.imageUrl && (
          <div className="uploaded-preview">
            <img src={draft.imageUrl} alt="Gambar soal" />
            <button
              className="text-link"
              type="button"
              onClick={() => onChange({ ...draft, imageUrl: null })}
            >
              Hapus gambar
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onPreview}>
            <Eye size={16} />
            Pratinjau
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" disabled={busy || uploading}>
            <Check size={17} />
            {busy ? 'Menyimpan…' : 'Simpan pertanyaan'}
          </button>
        </div>
      </form>
    </div>
  );
}

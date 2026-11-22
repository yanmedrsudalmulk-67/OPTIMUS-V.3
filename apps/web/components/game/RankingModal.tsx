'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Crown,
  Sparkles,
  Swords,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react';
import { playSound } from '../../lib/audio';
import {
  formatRankingEntries,
  type PublicLeader,
} from '../../lib/ranking';
import './ranking.css';

interface RankingModalProps {
  leaders: PublicLeader[];
  loading: boolean;
  onClose: () => void;
}

const LIKES_STORAGE_KEY = 'medical-tug:ranking-likes:v1';

function readLikedIds(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LIKES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function RankingModal({
  leaders,
  loading,
  onClose,
}: RankingModalProps) {
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLikedIds(readLikedIds());
  }, []);

  const board = useMemo(() => formatRankingEntries(leaders), [leaders]);

  const toggleLike = (id: string) => {
    playSound('click');
    setLikedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Ignore storage errors cleanly */
      }
      return next;
    });
  };

  return (
    <div
      className="rk-backdrop"
      onClick={onClose}
      data-testid="ranking-modal-backdrop"
    >
      <div
        className="rk-board"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Papan Peringkat Medical Tug of War"
        data-testid="ranking-modal"
      >
        {/* TOP HEADER BAR (Center N° 1 + Cyan Flare, Right Brand Lockup & Close) */}
        <header className="rk-header">
          <div className="rk-header-spacer" aria-hidden="true" />

          <div className="rk-hero-title">
            <div className="rk-no1-wrap">
              <span className="rk-no1-text">N° 1</span>
              <span className="rk-no1-flare" aria-hidden="true" />
            </div>
            <p className="rk-subtitle">
              <Sparkles size={14} className="rk-subtitle-icon" aria-hidden="true" />
              <span>Medical Tug of War / RSUD Al-Mulk • Papan Peringkat</span>
            </p>
          </div>

          <div className="rk-header-right">
            <div className="rk-brand-lockup" aria-hidden="true">
              <span className="rk-brand-badge">
                <Swords size={16} strokeWidth={2.6} />
              </span>
              <span className="rk-brand-word">
                <em>MED</em>
                <strong>ARENA</strong>
              </span>
            </div>

            <button
              type="button"
              className="rk-close-btn"
              onClick={onClose}
              aria-label="Tutup papan peringkat"
            >
              <X size={18} strokeWidth={2.8} />
            </button>
          </div>
        </header>

        {/* COLUMN HEADER STRIP */}
        <div className="rk-columns-bar" aria-hidden="true">
          <span className="rk-col-rank">Ranking</span>
          <span className="rk-col-name">Tim / Pemain</span>
          <span className="rk-col-stat">Skor</span>
          <span className="rk-col-stat">Benar</span>
          <span className="rk-col-stat">Power</span>
          <span className="rk-col-action" />
        </div>

        {/* RANKED LEADERBOARD ROWS */}
        <div className="rk-rows-viewport">
          {loading ? (
            <div className="rk-state-box">
              <span className="spinner" />
              <strong>Memuat Papan Peringkat…</strong>
              <p>Menyiapkan data skor dan performa terbaik dari arena.</p>
            </div>
          ) : board.rows.length === 0 ? (
            <div className="rk-state-box">
              <Trophy size={40} className="rk-empty-trophy" />
              <strong>Panggung Para Juara Masih Terbuka</strong>
              <p>
                Selesaikan satu pertandingan tarik tambang untuk mencatatkan nama tim,
                karakter, dan skor terbaik Anda di sini.
              </p>
            </div>
          ) : (
            <ol className="rk-rows-list">
              {board.rows.slice(0, 12).map((row) => {
                const isTop1 = row.rank === 1;
                const isTop3 = row.rank <= 3;
                const liked = Boolean(likedIds[row.id]);
                return (
                  <li
                    key={row.id}
                    className={`rk-row ${isTop1 ? 'is-rank-1' : ''} ${
                      isTop3 ? 'is-top3' : 'is-standard'
                    }`}
                    data-testid={`ranking-row-${row.rank}`}
                  >
                    {/* LEFT SLANTED RANK NUMBER BLOCK */}
                    <div className="rk-rank-zone">
                      <div className={`rk-rank-flag ${isTop3 ? 'is-cyan' : 'is-slate'}`}>
                        <span className="rk-rank-slash" aria-hidden="true" />
                        <span className="rk-rank-num">{row.rank}</span>
                      </div>

                      {row.medal && (
                        <span
                          className={`rk-medal is-${row.medal}`}
                          aria-label={`Peringkat ${row.rank}`}
                        >
                          {row.medal === 'gold' ? (
                            <Crown size={15} strokeWidth={2.5} />
                          ) : (
                            <Award size={15} strokeWidth={2.5} />
                          )}
                        </span>
                      )}
                    </div>

                    {/* AVATAR + CUSTOM TEAM NAME + CUSTOM CHARACTERS SUB-LINE */}
                    <div className="rk-identity">
                      <div className="rk-avatar-frame">
                        <img
                          src={row.avatarPath}
                          alt={row.name}
                          draggable={false}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="rk-name-meta">
                        <strong className="rk-team-name">{row.name}</strong>
                        <span className="rk-team-sub">
                          <span className="rk-tier-tag">Tier {row.tier}</span>
                          <Trophy size={11} className="rk-mini-trophy" aria-hidden="true" />
                          <span>{row.power}P</span>
                          {row.memberSummary && (
                            <span className="rk-members-list"> · {row.memberSummary}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* NUMERIC STATS */}
                    <div className="rk-stat-cell" aria-label={`Skor ${row.score}`}>
                      {row.score}
                    </div>
                    <div className="rk-stat-cell" aria-label={`Jawaban benar ${row.correctCount}`}>
                      {row.correctCount}
                    </div>
                    <div className="rk-stat-cell" aria-label={`Power ${row.power}`}>
                      {row.power}
                    </div>

                    {/* RIGHT APPRECIATION THUMBS-UP BUTTON */}
                    <div className="rk-action-cell">
                      <button
                        type="button"
                        className={`rk-like-btn ${liked ? 'is-liked' : ''}`}
                        onClick={() => toggleLike(row.id)}
                        aria-pressed={liked}
                        aria-label={`Beri apresiasi untuk ${row.name}`}
                      >
                        <ThumbsUp size={15} strokeWidth={2.4} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* BOTTOM MVP SUMMARY STRIP */}
        <footer className="rk-footer">
          <div className="rk-mvp-left">
            {board.mvp ? (
              <>
                <div className="rk-mvp-avatar">
                  <img
                    src={board.mvp.avatarPath}
                    alt={board.mvp.name}
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="rk-mvp-identity">
                  <strong>{board.mvp.name}</strong>
                  <span>
                    {board.mvp.memberSummary || `Skor ${board.mvp.score} • ${board.mvp.power} Power`}
                  </span>
                </div>
              </>
            ) : (
              <div className="rk-mvp-identity">
                <strong>Belum Ada MVP</strong>
                <span>Jadilah tim pertama yang meraih peringkat #1</span>
              </div>
            )}
          </div>

          <div className="rk-mvp-banner">
            <span className="rk-mvp-label">Performa Terbaik:</span>
            <span className="rk-mvp-badge">MVP</span>
            <span className="rk-mvp-desc">
              {board.mvp
                ? 'Tim dengan skor dan tarikan tertinggi di arena'
                : 'Raih kemenangan untuk merebut gelar MVP'}
            </span>
          </div>

          <Link
            href="/play"
            className="rk-play-cta"
            onClick={() => {
              playSound('ready');
              onClose();
            }}
          >
            MULAI BERTANDING <ArrowRight size={15} />
          </Link>
        </footer>
      </div>
    </div>
  );
}

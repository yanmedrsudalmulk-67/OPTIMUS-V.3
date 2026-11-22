'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import type { RoomState } from '../../../../packages/shared/src';
import { formatVictorySummary } from '../../lib/arenaLayout';

export interface VictoryBannerProps {
  state: RoomState;
  showHomeButton?: boolean;
}

/**
 * Transparent, high-impact esports Victory overlay inspired by kinetic diagonal
 * slash graphics. Keeps the center of the 3D arena completely unobstructed so
 * winning/falling 3D hero animations and confetti remain clearly visible.
 */
export default function VictoryBanner({ state, showHomeButton = true }: VictoryBannerProps) {
  const summary = formatVictorySummary(state);
  const accentClass =
    summary.winnerSide === 'B'
      ? 'is-team-b'
      : summary.winnerSide === 'DRAW'
        ? 'is-draw'
        : 'is-team-a';

  return (
    <div
      className={`vb-overlay ${accentClass}`}
      role="status"
      aria-live="polite"
      data-testid="victory-banner"
    >
      {/* TOP-CENTER KINETIC SLASH BANNER (Leaves 3D characters below 100% clear) */}
      <div className="vb-header-burst">
        {/* Dynamic diagonal black & neon-accent slash artwork */}
        <svg
          className="vb-slash-svg"
          viewBox="0 0 960 280"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="vbNeonLime" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#84ff1f" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#a3ff12" />
            </linearGradient>
            <linearGradient id="vbNeonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="vbNeonViolet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="vbNeonGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Outer kinetic edge accent shards */}
          <polygon points="18,12 152,86 112,96 2,34" fill="url(#vbNeonViolet)" opacity="0.92" />
          <polygon points="0,84 166,118 148,127 0,103" fill="url(#vbNeonCyan)" opacity="0.95" />
          <polygon points="956,42 752,102 778,111 960,64" fill="url(#vbNeonLime)" opacity="0.96" />
          <polygon points="960,178 784,158 802,167 960,196" fill="url(#vbNeonGold)" opacity="0.95" />
          <polygon points="822,196 868,242 846,245 810,204" fill="#ec4899" opacity="0.9" />

          {/* Main intersecting razor-black diagonal burst ribbons */}
          <polygon
            points="66,232 454,114 912,48 538,162 118,248"
            fill="#070c16"
            opacity="0.94"
          />
          <polygon
            points="212,32 518,122 864,238 492,164 256,64"
            fill="#0a101d"
            opacity="0.92"
          />
          <polygon
            points="296,58 686,74 714,158 264,174"
            fill="#080d18"
            opacity="0.82"
          />

          {/* Sharp inner neon highlight streaks hugging the black ribbons */}
          <polygon points="84,238 424,148 432,155 72,248" fill="url(#vbNeonLime)" />
          <polygon points="552,112 910,44 914,52 562,120" fill="url(#vbNeonLime)" />
          <polygon points="270,118 296,104 316,120 288,134" fill="url(#vbNeonViolet)" opacity="0.88" />
          <polygon points="658,158 692,184 674,196 648,168" fill="url(#vbNeonCyan)" opacity="0.85" />
        </svg>

        {/* Bold Italic Kinetic Title */}
        <div className="vb-title-stack">
          <h1 className="vb-headline" data-text={summary.headline}>
            {summary.headline}
          </h1>

          {/* Slim dark winner subtitle strip right underneath title */}
          <div className="vb-subtitle-strip">
            <span>{summary.subtitle}</span>
          </div>

          {/* Crisp italic score readout matching reference (e.g. 4 - 1) */}
          <div
            className="vb-score-row"
            aria-label={`Skor ${summary.leftTeamName} ${summary.leftValue} melawan ${summary.rightTeamName} ${summary.rightValue}`}
          >
            <span className="vb-score-num vb-score-a">{summary.leftValue}</span>
            <span className="vb-score-dash">-</span>
            <span className="vb-score-num vb-score-b">{summary.rightValue}</span>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION: ONLY "Kembali ke beranda" */}
      {showHomeButton && (
        <div className="vb-bottom-actions">
          <Link href="/" className="vb-home-btn" data-testid="victory-home-btn">
            <Home size={18} />
            <span>Kembali ke beranda</span>
          </Link>
        </div>
      )}
    </div>
  );
}

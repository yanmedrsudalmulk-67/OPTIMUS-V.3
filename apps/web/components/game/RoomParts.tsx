'use client';

import {
  Check,
  CheckCheck,
  Circle,
  Flag,
  HeartPulse,
  Radio,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { CHARACTERS, type Player, type RoomState, type Team } from '@shared/index';

export function GameHeader({ connected, code }: { connected: boolean; code?: string }) {
  return (
    <header className="player-header">
      <Link href="/" className="game-brand">
        <span>
          <HeartPulse size={23} />
        </span>
        <div>
          MEDICAL <strong>TUG OF WAR</strong>
        </div>
      </Link>
      <span className={`connection-label ${connected ? 'online' : 'offline'}`}>
        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{' '}
        {connected ? 'CONNECTED' : 'RECONNECTING'}
        {code && <b>{code}</b>}
      </span>
    </header>
  );
}
export function TeamRoster({
  state,
  team,
  compact = false,
}: {
  state: RoomState;
  team: Team;
  compact?: boolean;
}) {
  const players = state.players.filter((p) => p.team === team);
  return (
    <section className={`team-roster team-${team.toLowerCase()} ${compact ? 'compact' : ''}`}>
      <h3>
        <span className="team-dot" />
        {team === 'A' ? state.teamAName : state.teamBName}
        <small>{players.length}/3 pemain</small>
      </h3>
      <div className="roster-people">
        {Array.from({ length: 3 }, (_, i) => {
          const p = players[i],
            c = CHARACTERS.find((c) => c.id === p?.characterId);
          return (
            <div className={`roster-person ${p ? 'filled' : ''}`} key={p?.id || i}>
              <span
                className="roster-avatar"
                style={
                  p ? { background: `${c?.color || '#168e72'}22`, color: c?.color } : undefined
                }
              >
                {p ? p.name.slice(0, 2).toUpperCase() : <Circle size={19} />}
              </span>
              <div>
                <strong>{p?.name || 'Menunggu pemain'}</strong>
                <small>{p ? c?.profession : 'Slot tersedia'}</small>
              </div>
              {p && (
                <span
                  className={`ready-mark ${p.ready ? 'is-ready' : ''}`}
                  title={!p.connected ? 'Terputus' : p.ready ? 'Siap' : 'Belum siap'}
                >
                  {!p.connected ? (
                    <WifiOff size={15} />
                  ) : p.ready ? (
                    <CheckCheck size={17} />
                  ) : (
                    <Circle size={15} />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function Balance({ state }: { state: RoomState }) {
  const normalized = Math.max(
    -100,
    Math.min(100, (state.ropePosition / (state.settings.winThreshold || 100)) * 100),
  );
  return (
    <div className="balance-wrap">
      <div className="balance-label">
        <b>{state.teamAName}</b>
        <span>KESEIMBANGAN KEKUATAN</span>
        <b>{state.teamBName}</b>
      </div>
      <div className="balance-track">
        <div className="balance-center" />
        <span className="balance-marker" style={{ left: `${50 + normalized / 2}%` }}>
          <Flag size={11} />
        </span>
      </div>
      <div className="balance-values">
        <span>{state.teamAPower} POWER</span>
        <span>
          {Math.abs(Math.round(state.ropePosition))} / {state.settings.winThreshold}
        </span>
        <span>{state.teamBPower} POWER</span>
      </div>
    </div>
  );
}
export function ResultCard({ state, player }: { state: RoomState; player?: Player | null }) {
  const draw = state.winner === 'DRAW';
  const won = player && player.team === state.winner;
  const title = draw
    ? 'Sama kuat. Sama hebat!'
    : player
      ? won
        ? 'VICTORY!'
        : 'Tetap jadi pahlawan!'
      : 'VICTORY!';
  return (
    <section className={`game-results ${won ? 'won' : ''}`}>
      <div className="result-trophy">
        <Trophy size={40} />
      </div>
      <p className="eyebrow">PERTANDINGAN SELESAI</p>
      <h1>{title}</h1>
      <p>
        {draw
          ? 'Pertandingan berakhir seri.'
          : `${state.winner === 'A' ? state.teamAName : state.teamBName} memenangkan pertandingan.`}
      </p>
      {player && (
        <div className="personal-stats">
          <div>
            <b>{player.correctCount}</b>
            <span>Jawaban benar</span>
          </div>
          <div>
            <b>{player.power}</b>
            <span>Power tim</span>
          </div>
          <div>
            <b>{player.score}</b>
            <span>Total poin</span>
          </div>
        </div>
      )}
      <div className="result-table">
        {[...state.players]
          .sort((a, b) => b.score - a.score)
          .map((p, i) => (
            <div key={p.id}>
              <span className="result-rank">{i + 1}</span>
              <strong>
                {p.name}
                {p.id === player?.id && <small> ANDA</small>}
              </strong>
              <span className={p.team === 'A' ? 'green-text' : 'blue-text'}>
                {p.team === 'A' ? state.teamAName : state.teamBName}
              </span>
              <b>
                {p.score} <small>poin</small>
              </b>
            </div>
          ))}
      </div>
      <Link href="/" className="btn btn-primary">
        Kembali ke beranda
      </Link>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JoinResult, RoomState, Team } from '@shared/index';
import { api } from '../../lib/api';
import { emit, getSocket } from '../../lib/socket';
import { configureAudio, stopMusic } from '../../lib/audio';

export interface PlayerSession {
  token: string;
  playerId: string;
  name: string;
  team: Team;
  characterId: string;
}
export const sessionKey = (code: string) => `medical-player-${code.toUpperCase()}`;
export function readSession(code: string): PlayerSession | null {
  try {
    return JSON.parse(localStorage.getItem(sessionKey(code)) || 'null');
  } catch {
    return null;
  }
}
export function saveSession(code: string, session: PlayerSession) {
  localStorage.setItem(sessionKey(code), JSON.stringify(session));
  const socket = getSocket();
  socket.auth = { ...socket.auth, playerToken: session.token };
}
export function useRoom(rawCode: string, asPlayer = false) {
  const code = rawCode.toUpperCase();
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [tick, setTick] = useState(Date.now());
  const offset = useRef(0);
  const receive = useCallback(
    (next: RoomState) => {
      if (next.code !== code) return;
      offset.current = next.serverTime - Date.now();
      configureAudio({
        ...next.settings,
        music: next.settings.music && !next.paused && next.phase !== 'FINISHED',
      });
      setState(next);
      setLoading(false);
    },
    [code],
  );

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const socket = getSocket();
    const saved = asPlayer ? readSession(code) : null;
    setSession(saved);
    if (saved) socket.auth = { ...socket.auth, playerToken: saved.token };
    const restore = async () => {
      setConnected(true);
      try {
        if (saved) {
          const result = await emit<JoinResult>('room:join', { code, ...saved });
          if (mounted) {
            receive(result.state);
            setError('');
          }
        } else {
          const next = await emit<RoomState>('room:watch', { code });
          if (mounted && next) {
            receive(next);
            setError('');
          }
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Tidak dapat memulihkan koneksi.');
      }
    };
    const disconnect = () => setConnected(false);
    const connectionError = () => {
      setConnected(false);
    };
    socket.on('room:state', receive);
    socket.on('connect', restore);
    socket.on('disconnect', disconnect);
    socket.on('connect_error', connectionError);
    if (socket.connected) void restore();
    else socket.connect();
    api<RoomState>(`/rooms/${encodeURIComponent(code)}`)
      .then((next) => {
        if (mounted) receive(next);
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      });
    const interval = setInterval(() => setTick(Date.now()), 200);
    return () => {
      mounted = false;
      clearInterval(interval);
      stopMusic();
      socket.off('room:state', receive);
      socket.off('connect', restore);
      socket.off('disconnect', disconnect);
      socket.off('connect_error', connectionError);
    };
  }, [asPlayer, code, receive]);
  const seconds = state?.deadlineAt
    ? Math.max(
        0,
        Math.ceil(
          (state.deadlineAt - (state.paused ? state.serverTime : tick + offset.current)) / 1000,
        ),
      )
    : 0;
  const player = state?.players.find((p) => p.id === session?.playerId) || null;
  return { state, connected, loading, error, setError, session, player, seconds, receive };
}

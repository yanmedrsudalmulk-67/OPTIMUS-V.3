import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { cookieToken, getAdmin } from './auth';
import { codeSchema, errorMessage } from './validation';
import type { GameService } from './services/game';
export function registerSockets(io: Server, game: GameService) {
  io.on('connection', (socket: Socket) => {
    let identity: { playerId: string; code: string } | null = null;
    const calls = new Map<string, number[]>();
    function limited(key: string, limit: number, window = 10000) {
      const now = Date.now();
      const prior = (calls.get(key) || []).filter((t) => now - t < window);
      prior.push(now);
      calls.set(key, prior);
      if (prior.length > limit) throw new Error('Terlalu banyak aksi. Tunggu sebentar.');
    }
    const register = (name: string, fn: (payload: any) => Promise<unknown>) =>
      socket.on(name, async (payload: any, ack?: Function) => {
        try {
          limited(name, name === 'player:submit-answer' ? 12 : name === 'room:join' ? 10 : 40);
          const data = await fn(payload);
          if (typeof ack === 'function') ack({ ok: true, data });
        } catch (e) {
          if (typeof ack === 'function') ack({ ok: false, error: errorMessage(e) });
          else socket.emit('game:error', { error: errorMessage(e) });
        }
      });
    const requirePlayer = (payload: any) => {
      const code = codeSchema.parse(payload?.code);
      if (!identity || identity.code !== code) throw new Error('Sesi pemain diperlukan');
      return { ...identity, code };
    };
    register('room:watch', async (payload) => {
      const code = codeSchema.parse(payload?.code);
      const state = game.serialize(code);
      await socket.join(code);
      return state;
    });
    register('room:join', async (payload) => {
      if (identity) {
        await game.disconnect(identity.playerId, identity.code, socket.id);
      }
      const result = await game.join(payload, socket.id);
      identity = { playerId: result.playerId, code: result.state.code };
      if (!socket.connected) {
        await game.disconnect(identity.playerId, identity.code, socket.id);
        throw new Error('Koneksi telah terputus');
      }
      await socket.join(result.state.code);
      socket.emit('room:state', result.state);
      return result;
    });
    register('player:set-ready', async (payload) => {
      const p = requirePlayer(payload);
      return game.ready(p.code, p.playerId, z.boolean().parse(payload.ready));
    });
    register('player:select-character', async (payload) => {
      const p = requirePlayer(payload);
      return game.select(
        p.code,
        p.playerId,
        z.string().max(50).parse(payload.characterId),
        payload.name === undefined
          ? undefined
          : z.string().trim().min(2).max(30).parse(payload.name),
      );
    });
    register('player:submit-answer', async (payload) => {
      const p = requirePlayer(payload);
      return game.answer(
        p.code,
        p.playerId,
        z.string().max(100).parse(payload.questionId),
        z.number().int().min(0).max(3).parse(payload.answer),
      );
    });
    register('room:leave', async (payload) => {
      const p = requirePlayer(payload);
      const state = await game.leave(p.code, p.playerId);
      await socket.leave(p.code);
      identity = null;
      return state;
    });
    for (const action of [
      'start-match',
      'pause-match',
      'resume-match',
      'next-question',
      'end-match',
      'reset-match',
      'lock-lobby',
      'move-player',
      'kick-player',
    ])
      register('host:' + action, async (payload) => {
        if (!(await getAdmin(cookieToken(socket.handshake.headers.cookie))))
          throw new Error('Hak akses administrator diperlukan');
        const code = codeSchema.parse(payload?.code);
        if (action === 'move-player' || action === 'kick-player')
          z.string().min(1).max(100).parse(payload.playerId);
        if (action === 'move-player') z.enum(['A', 'B']).parse(payload.team);
        if (action === 'lock-lobby' && payload.locked !== undefined)
          z.boolean().parse(payload.locked);
        return game.host(code, action, payload);
      });
    const token = socket.handshake.auth?.playerToken;
    if (typeof token === 'string' && token.length < 200) {
      void game
        .reconnect(token, socket.id)
        .then(async (result) => {
          identity = { playerId: result.playerId, code: result.code };
          if (!socket.connected) {
            await game.disconnect(identity.playerId, identity.code, socket.id);
            return;
          }
          await socket.join(result.code);
          socket.emit('room:state', result.state);
        })
        .catch(() =>
          socket.emit('game:error', { error: 'Sesi sebelumnya tidak dapat dipulihkan' }),
        );
    }
    socket.on('disconnect', () => {
      if (identity)
        void game
          .disconnect(identity.playerId, identity.code, socket.id)
          .catch((e) => console.error('Disconnect persistence error', e));
    });
  });
}

import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { cookieToken, getAdmin } from './auth';
import { codeSchema, teamUpdateSchema, errorMessage } from './validation';
import type { GameService } from './services/game';
import type { Team } from '../../../packages/shared/src';

export function registerSockets(io: Server, game: GameService) {
  io.on('connection', (socket: Socket) => {
    let identity: { teamId: string; team: Team; code: string } | null = null;
    let identityQueue: Promise<unknown> = Promise.resolve();
    const sequenceIdentity = <T>(action: () => Promise<T>) => {
      const task = identityQueue.catch(() => {}).then(action);
      identityQueue = task;
      return task;
    };
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
          limited(name, name.includes('answer') ? 12 : name.includes('join') ? 10 : 40);
          const data = await fn(payload);
          if (typeof ack === 'function') ack({ ok: true, data });
        } catch (e) {
          if (typeof ack === 'function') ack({ ok: false, error: errorMessage(e) });
          else socket.emit('game:error', { error: errorMessage(e) });
        }
      });

    const requireTeam = (payload: any) => {
      const code = codeSchema.parse(payload?.code);
      if (
        !identity ||
        identity.code !== code ||
        !game.hasTeamConnection(code, identity.team, socket.id)
      )
        throw new Error('Sesi pengendali tim diperlukan');
      return { ...identity, code };
    };

    register('room:watch', async (payload) => {
      const code = codeSchema.parse(payload?.code);
      const state = game.serialize(code);
      await socket.join(code);
      return state;
    });

    const handleJoin = (payload: any) =>
      sequenceIdentity(async () => {
        // A rejected join must not disconnect a controller's current team.
        const previous = identity;
        const result = await game.join(payload, socket.id);
        if (previous && (previous.code !== result.state.code || previous.team !== result.team)) {
          await game.disconnect(previous.teamId, previous.code, socket.id);
          if (previous.code !== result.state.code) await socket.leave(previous.code);
        }
        identity = { teamId: result.teamId, team: result.team, code: result.state.code };
        if (!socket.connected) {
          await game.disconnect(identity.teamId, identity.code, socket.id);
          throw new Error('Koneksi telah terputus');
        }
        await socket.join(result.state.code);
        socket.emit('room:state', result.state);
        return result;
      });

    register('room:join', handleJoin);
    register('team:join', handleJoin);

    register('team:update', async (payload) => {
      const t = requireTeam(payload);
      return game.updateTeam(t.code, t.team, teamUpdateSchema.parse(payload));
    });

    register('team:ready', async (payload) => {
      const t = requireTeam(payload);
      return game.ready(t.code, t.team, z.boolean().parse(payload.ready));
    });

    register('player:set-ready', async (payload) => {
      const t = requireTeam(payload);
      return game.ready(t.code, t.team, z.boolean().parse(payload.ready));
    });

    register('team:submit-answer', async (payload) => {
      const t = requireTeam(payload);
      return game.answer(
        t.code,
        t.team,
        z.string().max(100).parse(payload.questionId),
        z.number().int().min(0).max(3).parse(payload.answer),
      );
    });

    register('player:submit-answer', async (payload) => {
      const t = requireTeam(payload);
      return game.answer(
        t.code,
        t.team,
        z.string().max(100).parse(payload.questionId),
        z.number().int().min(0).max(3).parse(payload.answer),
      );
    });

    register('team:start-match', async () => {
      throw new Error('Pertandingan hanya dapat dimulai oleh Admin dari Ruang Kontrol');
    });

    register('player:select-character', async (payload) => {
      const t = requireTeam(payload);
      return game.select(
        t.code,
        t.team,
        z.string().max(50).parse(payload.characterId),
        payload.name === undefined
          ? undefined
          : z.string().trim().min(1).max(30).parse(payload.name),
      );
    });

    register('room:leave', (payload) =>
      sequenceIdentity(async () => {
        const t = requireTeam(payload);
        const state = await game.leave(t.code, t.team);
        await socket.leave(t.code);
        identity = null;
        return state;
      }),
    );

    for (const action of [
      'start-match',
      'pause-match',
      'resume-match',
      'next-question',
      'end-match',
      'reset-match',
      'lock-lobby',
    ])
      register('host:' + action, async (payload) => {
        if (!(await getAdmin(cookieToken(socket.handshake.headers.cookie)))) {
          throw new Error('Hak akses administrator diperlukan');
        }
        const code = codeSchema.parse(payload?.code);
        if (action === 'lock-lobby' && payload.locked !== undefined) {
          z.boolean().parse(payload.locked);
        }
        return game.host(code, action, payload);
      });

    const token = socket.handshake.auth?.playerToken;
    if (typeof token === 'string' && token.length < 200) {
      void sequenceIdentity(async () => {
        const result = await game.reconnect(token, socket.id);
        identity = { teamId: result.teamId, team: result.team, code: result.code };
        if (!socket.connected) {
          await game.disconnect(identity.teamId, identity.code, socket.id);
          return;
        }
        await socket.join(result.code);
        socket.emit('room:state', result.state);
      }).catch(() =>
        socket.emit('game:error', { error: 'Sesi tim sebelumnya tidak dapat dipulihkan' }),
      );
    }

    socket.on('disconnect', () => {
      if (identity) {
        void game
          .disconnect(identity.teamId, identity.code, socket.id)
          .catch((e) => console.error('Disconnect persistence error', e));
      }
    });
  });
}

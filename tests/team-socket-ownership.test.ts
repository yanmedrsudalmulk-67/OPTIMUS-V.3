import { describe, expect, it, vi } from 'vitest';
import type { Server } from 'socket.io';
import type { GameService } from '../apps/realtime-server/src/services/game';
vi.mock('../apps/realtime-server/src/auth', () => ({
  cookieToken: vi.fn(),
  getAdmin: vi.fn().mockResolvedValue(null),
}));
import { registerSockets } from '../apps/realtime-server/src/sockets';

function connectedSocket() {
  const handlers = new Map<string, (...args: any[]) => void>();
  const connections = new Set<string>();
  const socket = {
    id: 'controller-socket',
    connected: true,
    handshake: { auth: {}, headers: {} },
    on: vi.fn((name, handler) => handlers.set(name, handler)),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
  };
  const game = {
    join: vi.fn(async ({ code, team }) => {
      connections.add(`${code}_${team}`);
      return { teamId: `id-${team}`, team, state: { code } };
    }),
    disconnect: vi.fn(async (id, code) => {
      connections.delete(`${code}_${id.slice(3)}`);
    }),
    hasTeamConnection: vi.fn((code, team) => connections.has(`${code}_${team}`)),
    updateTeam: vi.fn(async (code, team, data) => ({ code, team, ...data })),
    leave: vi.fn(async (code, team) => {
      connections.delete(`${code}_${team}`);
      return {};
    }),
  };
  const io = {
    on: vi.fn((name, handler) => {
      if (name === 'connection') handler(socket);
    }),
  };
  registerSockets(io as unknown as Server, game as unknown as GameService);
  const call = (name: string, payload: unknown) =>
    new Promise<any>((resolve) => handlers.get(name)!(payload, resolve));
  return { game, call, connections };
}

describe('Controller ownership at the Socket.IO boundary', () => {
  it('rejects spectator edits and derives the owner from the authenticated socket, never a payload team', async () => {
    const { game, call } = connectedSocket();
    expect(await call('team:update', { code: 'TEST42', teamName: 'Spoof' })).toMatchObject({
      ok: false,
    });
    expect(game.updateTeam).not.toHaveBeenCalled();
    expect(await call('team:join', { code: 'TEST42', team: 'A' })).toMatchObject({ ok: true });
    expect(
      await call('team:update', { code: 'TEST42', team: 'B', teamName: 'My Team' }),
    ).toMatchObject({ ok: true });
    expect(game.updateTeam).toHaveBeenLastCalledWith('TEST42', 'A', { teamName: 'My Team' });
    expect(await call('team:update', { code: 'OTHER1', teamName: 'Other room' })).toMatchObject({
      ok: false,
    });
    expect(game.updateTeam).toHaveBeenCalledTimes(1);
  });

  it('retains ownership after a rejected join and revokes it after leaving', async () => {
    const { game, call } = connectedSocket();
    await call('team:join', { code: 'TEST42', team: 'A' });
    game.join.mockRejectedValueOnce(new Error('Team B occupied'));
    expect(await call('team:join', { code: 'TEST42', team: 'B' })).toMatchObject({ ok: false });
    expect(game.disconnect).not.toHaveBeenCalled();
    expect(
      await call('team:update', { code: 'TEST42', characterNames: [{ slot: 0, name: 'Andi' }] }),
    ).toMatchObject({ ok: true });
    await call('room:leave', { code: 'TEST42' });
    expect(await call('team:update', { code: 'TEST42', teamName: 'Stale' })).toMatchObject({
      ok: false,
    });
    expect(game.updateTeam).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent joins so one socket cannot retain two editable identities', async () => {
    const { game, call, connections } = connectedSocket();
    const results = await Promise.all([
      call('team:join', { code: 'TEST42', team: 'A' }),
      call('team:join', { code: 'TEST42', team: 'B' }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect([...connections]).toEqual(['TEST42_B']);
    expect(game.disconnect).toHaveBeenCalledWith('id-A', 'TEST42', 'controller-socket');
    await call('team:update', { code: 'TEST42', team: 'A', teamName: 'Current owner' });
    expect(game.updateTeam).toHaveBeenCalledWith('TEST42', 'B', { teamName: 'Current owner' });
  });

  it('rejects an identity whose connections were revoked by another tab', async () => {
    const { call, game, connections } = connectedSocket();
    await call('team:join', { code: 'TEST42', team: 'A' });
    connections.clear();
    expect(await call('team:update', { code: 'TEST42', teamName: 'Old tab' })).toMatchObject({
      ok: false,
    });
    expect(game.updateTeam).not.toHaveBeenCalled();
  });
});

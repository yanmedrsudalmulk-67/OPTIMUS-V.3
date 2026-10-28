import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'socket.io';
import {
  CHARACTERS,
  DEFAULT_SETTINGS,
  defaultTeamCharacters,
  type RoomState,
} from '../packages/shared/src';
import { characterSlotsSchema, teamUpdateSchema } from '../apps/realtime-server/src/validation';

const db = vi.hoisted(() => ({
  character: { upsert: vi.fn() },
  questionPackage: { findUnique: vi.fn() },
  match: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  matchTeam: { upsert: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  matchTeamCharacter: { upsert: vi.fn() },
  matchQuestion: { update: vi.fn(), updateMany: vi.fn() },
  teamAnswer: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  playerAnswer: { deleteMany: vi.fn() },
  matchRound: { create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../packages/database/client', () => ({ prisma: db }));
import { GameService } from '../apps/realtime-server/src/services/game';

const teamRows = new Map<string, Record<string, unknown>>();
let lastSaved: any;
let game: GameService;
let broadcast: ReturnType<typeof vi.fn>;
let created: RoomState;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
  vi.resetAllMocks();
  teamRows.clear();
  lastSaved = undefined;
  db.questionPackage.findUnique.mockResolvedValue({
    id: 'quiz-fixture',
    name: 'Medical fixture',
    active: true,
    questions: [
      {
        id: 'source-question',
        packageId: 'quiz-fixture',
        text: 'Pilih jawaban benar',
        options: ['Benar', 'Salah', 'Lain', 'Tidak'],
        correctAnswer: 0,
        explanation: 'Benar',
        duration: 60,
        points: 100,
        active: true,
        sortOrder: 0,
      },
    ],
  });
  db.match.findUnique.mockResolvedValue(null);
  db.match.create.mockImplementation(async ({ data }) => {
    for (const team of data.teams.create) teamRows.set(team.id, { ...team, matchId: data.id });
    return data;
  });
  db.match.update.mockImplementation(async ({ data }) => {
    lastSaved = structuredClone(data);
    return data;
  });
  db.matchTeam.upsert.mockImplementation(async ({ where, create, update }) => {
    const row = [...teamRows.values()].find(
      (t) =>
        t.matchId === where.matchId_teamSide.matchId &&
        t.teamSide === where.matchId_teamSide.teamSide,
    );
    if (row) {
      Object.assign(row, update);
      return row;
    }
    teamRows.set(create.id, create);
    return create;
  });
  db.matchTeam.updateMany.mockImplementation(async ({ where, data }) => {
    const row = [...teamRows.values()].find(
      (t) => t.matchId === where.matchId && t.teamSide === where.teamSide,
    );
    if (row) Object.assign(row, data);
    return { count: row ? 1 : 0 };
  });
  db.matchTeam.findFirst.mockImplementation(
    async ({ where }) =>
      [...teamRows.values()].find((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ) ?? null,
  );
  db.matchTeamCharacter.upsert.mockResolvedValue({});
  db.$transaction.mockImplementation(async (writes) => Promise.all(writes));
  broadcast = vi.fn();
  game = new GameService({ to: () => ({ emit: broadcast }) } as unknown as Server);
  created = await game.create({
    title: 'Presentation fixture',
    packageId: 'quiz-fixture',
    teamAName: 'Tim Green',
    teamBName: 'Tim Blue',
    settings: { ...DEFAULT_SETTINGS, duration: 60, countdownSeconds: 1, autoClose: false },
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function joinBoth() {
  const a = await game.join(
    { code: created.code, team: 'A', characters: defaultTeamCharacters('A') },
    'socket-a',
  );
  const b = await game.join(
    { code: created.code, team: 'B', characters: defaultTeamCharacters('B') },
    'socket-b',
  );
  await game.ready(created.code, 'A', true);
  await game.ready(created.code, 'B', true);
  return { a, b };
}
async function activeQuestion() {
  const joined = await joinBoth();
  await game.startMatch(created.code);
  await vi.advanceTimersByTimeAsync(1000);
  const state = game.serialize(created.code);
  expect(state.phase).toBe('QUESTION_ACTIVE');
  return { ...joined, state };
}
function gameplay(state: RoomState) {
  const { serverTime: _, teamAName: __, teamBName: ___, players, teams, ...rest } = state;
  return {
    ...rest,
    players: players.map(({ name, ...player }) => player),
    teams: Object.fromEntries(
      Object.entries(teams).map(([key, { name, characters, ...team }]) => [
        key,
        { ...team, characters: characters.map(({ name, ...slot }) => slot) },
      ]),
    ),
  };
}

describe('Team presentation changes through the real game service', () => {
  it('registers new heroes on startup while retaining existing metadata and custom characters', async () => {
    const existing = {
      id: 'doctor-m',
      name: 'Dokter lokal',
      modelPath: '/uploads/custom.glb',
      active: false,
    };
    const custom = { id: 'local-hero', name: 'Hero lokal' };
    const stored = new Map<string, Record<string, unknown>>([
      [existing.id, { ...existing }],
      [custom.id, { ...custom }],
    ]);
    db.character.upsert.mockImplementation(async ({ where, create, update }) => {
      const record = stored.get(where.id);
      if (record) {
        Object.assign(record, update);
        return record;
      }
      stored.set(create.id, create);
      return create;
    });
    db.match.findMany.mockResolvedValue([]);
    await game.initialize();
    await game.initialize();
    expect(stored.size).toBe(CHARACTERS.length + 1);
    expect(stored.get(existing.id)).toEqual(existing);
    expect(stored.get(custom.id)).toEqual(custom);
    for (const id of ['surgeon', 'radiographer']) {
      expect(stored.get(id)).toMatchObject({ id, thumbnailPath: `/heroes/${id}.webp` });
    }
    expect(db.match.create).toHaveBeenCalledTimes(1); // Only beforeEach's explicit fixture creation.
  });

  it('keeps two controllers and six visual slots, while rejecting forged/cross-team tokens', async () => {
    const { a } = await joinBoth();
    expect(game.serialize(created.code).players).toHaveLength(6);
    await expect(game.join({ code: created.code, team: 'A' }, 'third-device')).rejects.toThrow(
      'sudah memiliki pengendali',
    );
    await expect(
      game.join(
        { code: created.code, team: 'B', token: a.token, teamId: created.teams.B.id },
        'forged-device',
      ),
    ).rejects.toThrow('Sesi pengendali tim tidak valid');
    await expect(
      game.join(
        { code: created.code, team: 'A', token: 'invalid', teamId: a.teamId },
        'forged-device',
      ),
    ).rejects.toThrow('Sesi pengendali tim tidak valid');
    expect(game.hasTeamConnection(created.code, 'A', 'socket-a')).toBe(true);
    expect(game.hasTeamConnection(created.code, 'B', 'forged-device')).toBe(false);
  });

  it('allows the same hero on both teams and keeps names and slot IDs on a confirmed swap', async () => {
    const { a } = await joinBoth();
    await game.updateTeam(created.code, 'A', {
      characterNames: [{ slot: 1, name: 'Sari Pilihan' }],
    });
    const before = game.serialize(created.code);
    const swapped = before.teams.A.characters.map((slot) => ({
      ...slot,
      characterId: slot.slot === 1 ? before.teams.B.characters[0].characterId : slot.characterId,
    }));
    const result = await game.updateTeam(created.code, 'A', { characters: swapped });
    expect(result.teams.A.characters[1]).toEqual({
      slot: 1,
      characterId: before.teams.B.characters[0].characterId,
      name: 'Sari Pilihan',
    });
    expect(result.teams.A.ready).toBe(false);
    expect(result.teams.B).toEqual(before.teams.B);
    expect(result.players.map((p) => p.id)).toEqual(before.players.map((p) => p.id));
    const resumed = await game.join(
      {
        code: created.code,
        team: 'A',
        token: a.token,
        characters: before.teams.A.characters,
        teamName: 'Old snapshot',
      },
      'reload-lobby',
    );
    expect(resumed.state.teams.A.characters).toEqual(result.teams.A.characters);
    expect(resumed.state.teamAName).toBe(result.teamAName);
  });

  it('renames an active team and slot without changing answers, IDs, scoring, phase or deadline', async () => {
    const { state, a } = await activeQuestion();
    await game.answer(created.code, 'A', state.question!.id, 0);
    const before = game.serialize(created.code);
    const internalBefore = structuredClone(lastSaved.state);
    const renamed = await game.updateTeam(created.code, 'A', {
      teamName: 'Infection Fighters',
      characterNames: [{ slot: 0, name: 'Dr. Andi' }],
    });
    expect(renamed.teamAName).toBe('Infection Fighters');
    expect(renamed.teams.A.name).toBe('Infection Fighters');
    expect(renamed.players[0].name).toBe('Dr. Andi');
    expect(gameplay(renamed)).toEqual(gameplay(before));
    expect(lastSaved.state.answers).toEqual(internalBefore.answers);
    expect(lastSaved.state.streaks).toEqual(internalBefore.streaks);
    expect(lastSaved.state.scored).toEqual(internalBefore.scored);
    expect(db.teamAnswer.create).toHaveBeenCalledTimes(1);
    await expect(game.answer(created.code, 'A', state.question!.id, 1)).rejects.toThrow(
      'sudah mengirimkan jawaban',
    );
    expect(broadcast).toHaveBeenLastCalledWith(
      'room:state',
      expect.objectContaining({ teamAName: 'Infection Fighters' }),
    );
    expect(db.matchTeamCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matchTeamId_slotNumber: { matchTeamId: a.teamId, slotNumber: 0 } },
        update: expect.objectContaining({ characterDisplayName: 'Dr. Andi' }),
      }),
    );

    // A reconnect from an old localStorage snapshot cannot silently undo the rename.
    const reconnected = await game.join(
      {
        code: created.code,
        team: 'A',
        token: a.token,
        teamName: 'Old name',
        characters: state.teams.A.characters,
      },
      'reloaded-a',
    );
    expect(reconnected.state.teams.A.name).toBe('Infection Fighters');
    expect(reconnected.state.teams.A.characters[0].name).toBe('Dr. Andi');
    expect(gameplay(reconnected.state)).toEqual(gameplay(renamed));
  });

  it('rejects character/ready changes after start atomically, including a mixed rename payload', async () => {
    const { state, a } = await activeQuestion();
    const changed = state.teams.A.characters.map((slot) => ({
      ...slot,
      characterId: slot.slot === 0 ? 'surgeon' : slot.characterId,
    }));
    await expect(
      game.updateTeam(created.code, 'A', { teamName: 'Must not save', characters: changed }),
    ).rejects.toThrow('dikunci');
    expect(game.serialize(created.code)).toEqual(state);
    await expect(game.updateTeam(created.code, 'A', { ready: false })).rejects.toThrow('dikunci');
    const resumed = await game.join(
      { code: created.code, team: 'A', token: a.token, characters: changed },
      'reloaded-a',
    );
    expect(resumed.state.teams.A.characters).toEqual(state.teams.A.characters);
    await expect(game.startMatch(created.code)).rejects.toThrow('sudah dimulai');
    expect(gameplay(game.serialize(created.code))).toEqual(gameplay(state));
  });

  it('allows name-only edits while paused or finished and preserves lobby readiness', async () => {
    await joinBoth();
    const lobbyState = await game.updateTeam(created.code, 'B', {
      characterNames: [{ slot: 2, name: 'Rizky' }],
    });
    expect(lobbyState.phase).toBe('READY');
    expect(lobbyState.teams.B.ready).toBe(true);
    await game.startMatch(created.code);
    await vi.advanceTimersByTimeAsync(1000);
    await game.host(created.code, 'pause-match');
    const paused = game.serialize(created.code);
    const edited = await game.updateTeam(created.code, 'B', { teamName: 'Blue Care' });
    expect(gameplay(edited)).toEqual(gameplay(paused));
    await game.host(created.code, 'end-match');
    const ended = game.serialize(created.code);
    const result = await game.updateTeam(created.code, 'B', {
      characterNames: [{ slot: 2, name: 'Rizky Akhir' }],
    });
    expect(gameplay(result)).toEqual(gameplay(ended));
    expect(result.players.find((p) => p.id === 'B_2')?.name).toBe('Rizky Akhir');
  });

  it('revokes all old socket authorizations and the old token when a team leaves', async () => {
    const { a } = await joinBoth();
    await game.join({ code: created.code, team: 'A', token: a.token }, 'another-tab-a');
    await game.leave(created.code, 'A');
    expect(game.hasTeamConnection(created.code, 'A', 'socket-a')).toBe(false);
    expect(game.hasTeamConnection(created.code, 'A', 'another-tab-a')).toBe(false);
    await expect(
      game.join({ code: created.code, team: 'A', token: a.token }, 'old-tab'),
    ).rejects.toThrow('Sesi pengendali tim tidak valid');
    const replacement = await game.join({ code: created.code, team: 'A' }, 'new-device');
    expect(replacement.token).not.toBe(a.token);
    expect(game.hasTeamConnection(created.code, 'A', 'new-device')).toBe(true);
  });

  it('does not authorize a new socket when persistence fails', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('write failure'));
    await expect(game.join({ code: created.code, team: 'A' }, 'failed-device')).rejects.toThrow(
      'write failure',
    );
    expect(game.hasTeamConnection(created.code, 'A', 'failed-device')).toBe(false);
    expect(game.serialize(created.code).teams.A.connected).toBe(false);
  });
});

describe('Presentation payload validation', () => {
  it('orders valid slots and rejects duplicate slots, empty/long names and unknown heroes', () => {
    const slots = defaultTeamCharacters('A');
    expect(characterSlotsSchema.parse([slots[2], slots[0], slots[1]])).toEqual(slots);
    expect(() => characterSlotsSchema.parse([slots[0], slots[0], slots[2]])).toThrow();
    expect(() =>
      teamUpdateSchema.parse({
        characterNames: [
          { slot: 0, name: 'One' },
          { slot: 0, name: 'Two' },
        ],
      }),
    ).toThrow();
    expect(() => teamUpdateSchema.parse({ teamName: ' '.repeat(5) })).toThrow();
    expect(() => teamUpdateSchema.parse({ teamName: 'x'.repeat(41) })).toThrow();
    expect(() =>
      teamUpdateSchema.parse({ characterNames: [{ slot: 1, name: 'x'.repeat(31) }] }),
    ).toThrow();
    expect(() =>
      characterSlotsSchema.parse(slots.map((slot) => ({ ...slot, characterId: 'unregistered' }))),
    ).toThrow();
  });
});

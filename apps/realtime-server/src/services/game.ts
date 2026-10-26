import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../packages/database/client';
import { calculateAward, calculateRound, winnerAtEnd } from '../../../../packages/game-engine/src';
import {
  CHARACTERS,
  defaultTeamCharacters,
  type RoomState,
  type Question,
  type Player,
  type Team,
  type TeamController,
  type TeamCharacterSlot,
  type RoundResult,
} from '../../../../packages/shared/src';
export { defaultTeamCharacters };
import { settings as parseSettings, matchSchema, joinSchema, teamJoinSchema } from '../validation';
import { hashToken } from '../auth';

interface Answer {
  answer: number;
  responseTimeMs: number;
}
interface Internal {
  state: RoomState;
  snapshots: Question[];
  answers: Record<string, Record<string, Answer>>;
  scored: string[];
  streaks: Record<string, number>;
  remainingMs: number;
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const revealed = new Set([
  'ANSWER_REVEAL',
  'PULL_ANIMATION',
  'ROUND_RESULT',
  'NEXT_QUESTION',
  'FINISHED',
]);
const lobby = (s: RoomState) => s.phase === 'WAITING' || s.phase === 'READY';


export class GameService {
  private rooms = new Map<string, Internal>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private queues = new Map<string, Promise<unknown>>();
  private teamSockets = new Map<string, Set<string>>(); // key: `${code}_${team}`

  constructor(private io: Server) {}

  async initialize() {
    const rows = await prisma.match.findMany({
      include: {
        answers: true,
        players: true,
        teams: { include: { characters: true } },
        teamAnswers: true,
      },
    });

    for (const row of rows) {
      const room = row.state as unknown as Internal;
      if (!room?.state?.code) continue;

      room.answers = {};
      for (const answer of row.answers) {
        (room.answers[answer.matchQuestionId] ||= {})[answer.playerId] = {
          answer: answer.selectedAnswer,
          responseTimeMs: answer.responseTimeMs,
        };
      }
      for (const teamAns of row.teamAnswers) {
        (room.answers[teamAns.matchQuestionId] ||= {})[teamAns.matchTeamId] = {
          answer: teamAns.selectedAnswer,
          responseTimeMs: teamAns.responseTimeMs,
        };
      }

      // Ensure teams structure exists
      if (!room.state.teams) {
        room.state.teams = {
          A: {
            id: `team_A_${row.id}`,
            team: 'A',
            name: room.state.teamAName || 'Tim Emerald',
            connected: false,
            ready: false,
            characters: defaultTeamCharacters('A'),
            score: 0,
            power: 0,
            correctCount: 0,
            answered: false,
          },
          B: {
            id: `team_B_${row.id}`,
            team: 'B',
            name: room.state.teamBName || 'Tim Sapphire',
            connected: false,
            ready: false,
            characters: defaultTeamCharacters('B'),
            score: 0,
            power: 0,
            correctCount: 0,
            answered: false,
          },
        };
      }

      room.state.teams.A.connected = false;
      room.state.teams.B.connected = false;
      room.state.teams.A.answered = !!room.answers[room.state.question?.id || '']?.[room.state.teams.A.id];
      room.state.teams.B.answered = !!room.answers[room.state.question?.id || '']?.[room.state.teams.B.id];

      this.syncPlayers(room);
      this.rooms.set(row.code, room);

      if (!lobby(room.state) && room.state.phase !== 'FINISHED') {
        room.remainingMs = room.state.paused
          ? Math.max(1, room.remainingMs)
          : Math.max(100, (room.state.deadlineAt || Date.now()) - Date.now());
        room.state.paused = true;
        room.state.deadlineAt = null;
      }
      this.updateLobby(room);
      await this.persist(room);
    }
  }

  syncPlayers(room: Internal) {
    const s = room.state;
    const tA = s.teams?.A;
    const tB = s.teams?.B;

    const charsA = tA?.characters || defaultTeamCharacters('A');
    const charsB = tB?.characters || defaultTeamCharacters('B');

    s.players = [
      ...charsA.map((c, i) => ({
        id: `A_${i}`,
        name: c.name || `Hero A${i + 1}`,
        team: 'A' as Team,
        characterId: c.characterId || 'doctor-m',
        connected: Boolean(tA?.connected),
        ready: Boolean(tA?.ready),
        correctCount: tA?.correctCount || 0,
        power: tA?.power || 0,
        score: tA?.score || 0,
        answered: Boolean(tA?.answered),
      })),
      ...charsB.map((c, i) => ({
        id: `B_${i}`,
        name: c.name || `Hero B${i + 1}`,
        team: 'B' as Team,
        characterId: c.characterId || 'doctor-f',
        connected: Boolean(tB?.connected),
        ready: Boolean(tB?.ready),
        correctCount: tB?.correctCount || 0,
        power: tB?.power || 0,
        score: tB?.score || 0,
        answered: Boolean(tB?.answered),
      })),
    ];
  }

  serialize(code: string): RoomState {
    const room = this.get(code);
    this.syncPlayers(room);
    const state = json(room.state) as RoomState;
    state.serverTime = Date.now();
    if (!revealed.has(state.phase)) {
      delete state.correctAnswer;
      delete state.explanation;
    }
    return state;
  }

  all() {
    return [...this.rooms.values()]
      .sort((a, b) => b.state.createdAt.localeCompare(a.state.createdAt))
      .map((r) => this.serialize(r.state.code));
  }

  getById(id: string) {
    const found = [...this.rooms.values()].find((r) => r.state.id === id);
    if (!found) throw new Error('Pertandingan tidak ditemukan');
    return this.serialize(found.state.code);
  }

  private get(code: string) {
    const r = this.rooms.get(code);
    if (!r) throw new Error('Room tidak ditemukan');
    return r;
  }

  run<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const before = this.queues.get(code) || Promise.resolve();
    const task = before
      .catch(() => {})
      .then(async () => {
        const existing = this.rooms.get(code);
        const checkpoint = existing ? (json(existing) as Internal) : null;
        try {
          return await fn();
        } catch (error) {
          if (checkpoint) {
            this.stopTimer(code);
            this.rooms.set(code, checkpoint);
            if (
              checkpoint.state.deadlineAt &&
              !checkpoint.state.paused &&
              checkpoint.state.phase !== 'FINISHED'
            ) {
              this.schedule(checkpoint, Math.max(1, checkpoint.state.deadlineAt - Date.now()));
            }
          }
          throw error;
        }
      });
    this.queues.set(code, task);
    void task
      .finally(() => {
        if (this.queues.get(code) === task) this.queues.delete(code);
      })
      .catch(() => {});
    return task;
  }

  private broadcast(room: Internal) {
    const s = this.serialize(room.state.code);
    this.io.to(room.state.code).emit('room:state', s);
  }

  private async persist(room: Internal, extra: Prisma.PrismaPromise<unknown>[] = []) {
    const s = room.state;
    this.syncPlayers(room);

    await prisma.$transaction([
      prisma.match.update({
        where: { id: s.id },
        data: {
          phase: s.phase,
          paused: s.paused,
          locked: s.locked,
          ropePosition: s.ropePosition,
          winner: s.winner,
          teamAName: s.teamAName,
          teamBName: s.teamBName,
          state: json(room),
          startedAt: s.startedAt ? new Date(s.startedAt) : null,
          finishedAt: s.finishedAt ? new Date(s.finishedAt) : null,
        },
      }),
      ...extra,
    ]);
    this.broadcast(room);
  }

  async create(input: unknown) {
    const data = matchSchema.parse(input);
    const pack = await prisma.questionPackage.findUnique({
      where: { id: data.packageId },
      include: { questions: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!pack || !pack.active || !pack.questions.length) {
      throw new Error('Paket harus memiliki soal aktif');
    }

    const config = parseSettings(data.settings);
    let qs = pack.questions.map((q) => ({ ...q, options: q.options as string[] }));
    if (config.shuffle) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    const initialCount = Math.min(qs.length, config.questionCount);
    if (!config.suddenDeath) qs = qs.slice(0, initialCount);

    const id = crypto.randomUUID();
    let code = '';
    do {
      code = Array.from(
        { length: 6 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)],
      ).join('');
    } while (this.rooms.has(code) || (await prisma.match.findUnique({ where: { code } })));

    const snapshots = qs.map((q) => ({ ...q, id: crypto.randomUUID() })) as Question[];

    const teamAId = crypto.randomUUID();
    const teamBId = crypto.randomUUID();

    const teams: { A: TeamController; B: TeamController } = {
      A: {
        id: teamAId,
        team: 'A',
        name: data.teamAName || 'Tim Emerald',
        connected: false,
        ready: false,
        characters: defaultTeamCharacters('A'),
        score: 0,
        power: 0,
        correctCount: 0,
        answered: false,
      },
      B: {
        id: teamBId,
        team: 'B',
        name: data.teamBName || 'Tim Sapphire',
        connected: false,
        ready: false,
        characters: defaultTeamCharacters('B'),
        score: 0,
        power: 0,
        correctCount: 0,
        answered: false,
      },
    };

    const state: RoomState = {
      id,
      code,
      title: data.title,
      packageId: pack.id,
      packageName: pack.name,
      teamAName: data.teamAName || 'Tim Emerald',
      teamBName: data.teamBName || 'Tim Sapphire',
      phase: 'WAITING',
      paused: false,
      locked: false,
      settings: config,
      teams,
      players: [],
      questionIndex: 0,
      questionCount: initialCount,
      question: null,
      deadlineAt: null,
      serverTime: Date.now(),
      ropePosition: 0,
      teamAPower: 0,
      teamBPower: 0,
      winner: null,
      rounds: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };

    const room: Internal = {
      state,
      snapshots,
      answers: {},
      scored: [],
      streaks: {},
      remainingMs: 0,
    };

    this.syncPlayers(room);

    await prisma.match.create({
      data: {
        id,
        code,
        title: data.title,
        packageId: pack.id,
        packageName: pack.name,
        teamAName: state.teamAName,
        teamBName: state.teamBName,
        phase: state.phase,
        settings: json(config),
        state: json(room),
        snapshots: json(snapshots),
        teams: {
          create: [
            {
              id: teamAId,
              teamSide: 'A',
              teamName: state.teamAName,
              controllerSessionId: crypto.randomBytes(32).toString('hex'),
              readyStatus: false,
              connectedStatus: false,
              characters: {
                create: teams.A.characters.map((c) => ({
                  slotNumber: c.slot,
                  characterId: c.characterId,
                  characterDisplayName: c.name,
                })),
              },
            },
            {
              id: teamBId,
              teamSide: 'B',
              teamName: state.teamBName,
              controllerSessionId: crypto.randomBytes(32).toString('hex'),
              readyStatus: false,
              connectedStatus: false,
              characters: {
                create: teams.B.characters.map((c) => ({
                  slotNumber: c.slot,
                  characterId: c.characterId,
                  characterDisplayName: c.name,
                })),
              },
            },
          ],
        },
        questions: {
          create: snapshots.map((q, i) => ({
            id: q.id,
            sourceQuestionId: qs[i].id,
            snapshot: json(q),
            questionOrder: i,
            status: 'WAITING',
          })),
        },
      },
    });

    this.rooms.set(code, room);
    return this.serialize(code);
  }

  async join(input: unknown, socketId: string) {
    const raw = input as any;
    const team: Team = raw.team === 'B' ? 'B' : 'A';
    const code: string = String(raw.code || '').trim().toUpperCase();

    return this.run(code, async () => {
      const room = this.get(code);
      const teamObj = room.state.teams[team];
      let token = raw.token as string | undefined;

      const teamKey = `${code}_${team}`;
      let connections = this.teamSockets.get(teamKey);
      if (!connections) {
        connections = new Set();
        this.teamSockets.set(teamKey, connections);
      }

      if (token) {
        const hashed = hashToken(token);
        const matchTeam = await prisma.matchTeam.findFirst({
          where: { matchId: room.state.id, controllerSessionId: hashed },
        });
        if (!matchTeam && teamObj.id !== raw.playerId && teamObj.id !== raw.teamId) {
          // Token mismatch or session expired
          token = undefined;
        }
      }

      if (!token) {
        if (!lobby(room.state) || room.state.locked) {
          throw new Error('Pertandingan sudah berlangsung atau lobby dikunci');
        }
        if (teamObj.connected && connections.size > 0) {
          throw new Error(`Tim ${team === 'A' ? 'A (Hijau)' : 'B (Biru)'} sudah memiliki pengendali yang terhubung`);
        }
        token = crypto.randomBytes(32).toString('hex');
      }

      // Update team properties
      teamObj.connected = true;
      if (raw.teamName && typeof raw.teamName === 'string') {
        const trimmed = raw.teamName.trim().slice(0, 40);
        if (trimmed) {
          teamObj.name = trimmed;
          if (team === 'A') room.state.teamAName = trimmed;
          else room.state.teamBName = trimmed;
        }
      }

      if (Array.isArray(raw.characters) && raw.characters.length === 3) {
        teamObj.characters = raw.characters.map((c: any, index: number) => ({
          slot: index,
          characterId: CHARACTERS.some((ch) => ch.id === c.characterId) ? c.characterId : 'doctor-m',
          name: (c.name || '').trim().slice(0, 30) || `Hero ${team}${index + 1}`,
        })) as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      } else if (raw.characterId && CHARACTERS.some((ch) => ch.id === raw.characterId)) {
        // Single character selection backwards compatibility: assign to slot 0
        teamObj.characters[0] = {
          slot: 0,
          characterId: raw.characterId,
          name: raw.name ? raw.name.trim().slice(0, 30) : teamObj.characters[0].name,
        };
      }

      connections.add(socketId);
      this.syncPlayers(room);
      this.updateLobby(room);

      const hashedToken = hashToken(token);
      await this.persist(room, [
        prisma.matchTeam.upsert({
          where: { matchId_teamSide: { matchId: room.state.id, teamSide: team } },
          create: {
            matchId: room.state.id,
            teamSide: team,
            teamName: teamObj.name,
            controllerSessionId: hashedToken,
            connectedStatus: true,
            readyStatus: teamObj.ready,
          },
          update: {
            teamName: teamObj.name,
            controllerSessionId: hashedToken,
            connectedStatus: true,
            readyStatus: teamObj.ready,
          },
        }),
      ]);

      return {
        token,
        team,
        teamId: teamObj.id,
        playerId: teamObj.id,
        state: this.serialize(code),
      };
    });
  }

  async authenticateTeam(token: string, code?: string) {
    const hashed = hashToken(token);
    const matchTeam = await prisma.matchTeam.findFirst({
      where: { controllerSessionId: hashed },
      include: { match: true },
    });
    if (!matchTeam) throw new Error('Sesi pengendali tim tidak valid');

    const room = [...this.rooms.values()].find((r) => r.state.id === matchTeam.matchId);
    if (!room || (code && room.state.code !== code)) {
      throw new Error('Pertandingan tidak ditemukan');
    }

    return {
      team: matchTeam.teamSide as Team,
      teamId: matchTeam.id,
      code: room.state.code,
    };
  }

  async reconnect(token: string, socketId: string) {
    const identity = await this.authenticateTeam(token);
    const r = this.get(identity.code);
    const teamObj = r.state.teams[identity.team];

    const result = await this.join(
      {
        code: identity.code,
        team: identity.team,
        teamName: teamObj.name,
        characters: teamObj.characters,
        token,
      },
      socketId,
    );
    return { ...identity, ...result };
  }

  async disconnect(teamId: string, code: string, socketId: string) {
    await this.run(code, async () => {
      const room = this.get(code);
      const team: Team = room.state.teams.A.id === teamId ? 'A' : 'B';
      const teamKey = `${code}_${team}`;
      const connections = this.teamSockets.get(teamKey);

      connections?.delete(socketId);
      if (connections?.size) return;

      room.state.teams[team].connected = false;
      this.syncPlayers(room);
      this.updateLobby(room);
      await this.persist(room, [
        prisma.matchTeam.updateMany({
          where: { matchId: room.state.id, teamSide: team },
          data: { connectedStatus: false },
        }),
      ]);
    });
  }

  private updateLobby(room: Internal) {
    if (lobby(room.state)) {
      const tA = room.state.teams.A;
      const tB = room.state.teams.B;
      const bothConnected = tA.connected && tB.connected;
      const bothReady = tA.ready && tB.ready;
      const charactersValid = tA.characters?.length === 3 && tB.characters?.length === 3;

      room.state.phase = bothConnected && bothReady && charactersValid ? 'READY' : 'WAITING';
    }
  }

  async ready(code: string, teamOrPlayerId: string, value: boolean) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Pertandingan sudah dimulai');

      const team: Team =
        teamOrPlayerId === 'B' || r.state.teams.B.id === teamOrPlayerId ? 'B' : 'A';
      r.state.teams[team].ready = value;

      this.syncPlayers(r);
      this.updateLobby(r);
      await this.persist(r, [
        prisma.matchTeam.updateMany({
          where: { matchId: r.state.id, teamSide: team },
          data: { readyStatus: value },
        }),
      ]);
      return this.serialize(code);
    });
  }

  async select(code: string, teamOrPlayerId: string, characterId: string, name?: string) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Pertandingan sudah dimulai');
      if (!CHARACTERS.some((c) => c.id === characterId)) throw new Error('Karakter tidak valid');

      const team: Team =
        teamOrPlayerId === 'B' || r.state.teams.B.id === teamOrPlayerId ? 'B' : 'A';
      const teamObj = r.state.teams[team];

      // Update slot 0 by default when called with single character
      teamObj.characters[0].characterId = characterId;
      if (name) teamObj.characters[0].name = name;
      teamObj.ready = false;

      this.syncPlayers(r);
      this.updateLobby(r);
      await this.persist(r);
      return this.serialize(code);
    });
  }

  async updateTeam(
    code: string,
    team: Team,
    payload: { teamName?: string; characters?: TeamCharacterSlot[]; ready?: boolean },
  ) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Pertandingan sudah dimulai');

      const teamObj = r.state.teams[team];
      if (payload.teamName && typeof payload.teamName === 'string') {
        const trimmed = payload.teamName.trim().slice(0, 40);
        if (trimmed) {
          teamObj.name = trimmed;
          if (team === 'A') r.state.teamAName = trimmed;
          else r.state.teamBName = trimmed;
        }
      }

      if (Array.isArray(payload.characters) && payload.characters.length === 3) {
        teamObj.characters = payload.characters.map((c, idx) => ({
          slot: idx,
          characterId: CHARACTERS.some((ch) => ch.id === c.characterId) ? c.characterId : 'doctor-m',
          name: (c.name || '').trim().slice(0, 30) || `Hero ${team}${idx + 1}`,
        })) as [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
      }

      if (payload.ready !== undefined) {
        teamObj.ready = Boolean(payload.ready);
      } else {
        teamObj.ready = false;
      }

      this.syncPlayers(r);
      this.updateLobby(r);
      await this.persist(r, [
        prisma.matchTeam.updateMany({
          where: { matchId: r.state.id, teamSide: team },
          data: { teamName: teamObj.name, readyStatus: teamObj.ready },
        }),
      ]);
      return this.serialize(code);
    });
  }

  async leave(code: string, teamOrPlayerId: string) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Slot tidak dapat dilepas saat pertandingan berlangsung');

      const team: Team =
        teamOrPlayerId === 'B' || r.state.teams.B.id === teamOrPlayerId ? 'B' : 'A';
      r.state.teams[team].connected = false;
      r.state.teams[team].ready = false;

      this.teamSockets.delete(`${code}_${team}`);
      this.syncPlayers(r);
      this.updateLobby(r);
      await this.persist(r, [
        prisma.matchTeam.updateMany({
          where: { matchId: r.state.id, teamSide: team },
          data: { connectedStatus: false, readyStatus: false },
        }),
      ]);
      return this.serialize(code);
    });
  }

  private stopTimer(code: string) {
    const timer = this.timers.get(code);
    if (timer) clearTimeout(timer);
    this.timers.delete(code);
  }

  private schedule(room: Internal, ms: number) {
    this.stopTimer(room.state.code);
    room.remainingMs = ms;
    room.state.deadlineAt = Date.now() + ms;
    const deadline = room.state.deadlineAt;
    const phase = room.state.phase;

    if (!room.state.paused) {
      this.timers.set(
        room.state.code,
        setTimeout(() => {
          void this.run(room.state.code, async () => {
            if (room.state.deadlineAt === deadline && room.state.phase === phase) {
              await this.transition(room);
            }
          }).catch((e) => console.error('Phase transition failed', e));
        }, ms),
      );
    }
  }

  private async beginQuestion(room: Internal) {
    const s = room.state;
    const q = room.snapshots[s.questionIndex];
    if (!q) {
      await this.finish(room);
      return;
    }

    s.phase = 'QUESTION_ACTIVE';
    s.question = {
      id: q.id,
      text: q.text,
      options: q.options,
      imageUrl: q.imageUrl,
      duration: s.settings.duration || q.duration,
      points: q.points,
    };
    delete s.correctAnswer;
    delete s.explanation;

    s.teams.A.answered = false;
    s.teams.B.answered = false;
    delete s.teams.A.lastAnswer;
    delete s.teams.B.lastAnswer;
    delete s.teams.A.lastCorrect;
    delete s.teams.B.lastCorrect;

    this.syncPlayers(room);

    const duration = (s.settings.duration || q.duration) * 1000;
    this.schedule(room, duration);

    await this.persist(room, [
      prisma.matchQuestion.update({
        where: { id: q.id },
        data: {
          status: 'QUESTION_ACTIVE',
          startedAt: new Date(),
          deadlineAt: new Date(s.deadlineAt!),
        },
      }),
    ]);
  }

  async answer(code: string, teamOrPlayerId: string, questionId: string, answer: number) {
    return this.run(code, async () => {
      const room = this.get(code);
      const s = room.state;
      const team: Team =
        teamOrPlayerId === 'B' || s.teams.B.id === teamOrPlayerId ? 'B' : 'A';
      const teamObj = s.teams[team];

      if (
        s.paused ||
        s.phase !== 'QUESTION_ACTIVE' ||
        s.question?.id !== questionId ||
        !s.deadlineAt ||
        Date.now() >= s.deadlineAt
      ) {
        throw new Error('Waktu menjawab sudah berakhir');
      }

      if (teamObj.answered || room.answers[questionId]?.[team]) {
        throw new Error(`Tim ${team} sudah mengirimkan jawaban`);
      }

      const responseTimeMs = Math.max(0, s.question.duration * 1000 - (s.deadlineAt - Date.now()));
      const q = room.snapshots[s.questionIndex];
      const isCorrect = answer === q.correctAnswer;

      const extraWrites: Prisma.PrismaPromise<unknown>[] = [
        prisma.teamAnswer.create({
          data: {
            matchId: s.id,
            matchQuestionId: questionId,
            matchTeamId: teamObj.id,
            selectedAnswer: answer,
            isCorrect,
            responseTimeMs,
          },
        }),
      ];

      (room.answers[questionId] ||= {})[team] = { answer, responseTimeMs };
      (room.answers[questionId] ||= {})[teamObj.id] = { answer, responseTimeMs };

      teamObj.answered = true;
      teamObj.lastAnswer = answer;

      this.syncPlayers(room);
      await this.persist(room, extraWrites);

      // Auto close when both teams have answered
      if (s.settings.autoClose && s.teams.A.answered && s.teams.B.answered) {
        this.stopTimer(code);
        this.timers.set(
          code,
          setTimeout(() => {
            void this.run(code, async () => {
              const current = this.get(code);
              if (current.state.phase === 'QUESTION_ACTIVE' && !current.state.paused) {
                await this.reveal(current);
              }
            }).catch((e) => console.error('Auto-close failed', e));
          }, 0),
        );
      }

      return { accepted: true, team, answer };
    });
  }

  private async reveal(room: Internal) {
    const s = room.state;
    const q = room.snapshots[s.questionIndex];
    if (room.scored.includes(q.id)) return;
    room.scored.push(q.id);

    s.phase = 'ANSWER_REVEAL';
    s.correctAnswer = q.correctAnswer;
    s.explanation = q.explanation;
    s.teamAPower = 0;
    s.teamBPower = 0;

    const extra: Prisma.PrismaPromise<unknown>[] = [];

    // Calculate score & power for Team A and Team B
    for (const team of ['A', 'B'] as Team[]) {
      const tObj = s.teams[team];
      const ansRecord = room.answers[q.id]?.[team] || room.answers[q.id]?.[tObj.id];
      const correct = Boolean(ansRecord && ansRecord.answer === q.correctAnswer);

      tObj.lastAnswer = ansRecord?.answer;
      tObj.lastCorrect = correct;

      const award = calculateAward({
        correct,
        points: q.points,
        baseCorrectPower: s.settings.baseCorrectPower,
        responseTimeMs: ansRecord?.responseTimeMs || 0,
        durationMs: (s.settings.duration || q.duration) * 1000,
        streak: room.streaks[team] || 0,
        speedBonus: s.settings.speedBonus,
        comboBonus: s.settings.comboBonus,
      });

      room.streaks[team] = correct ? (room.streaks[team] || 0) + 1 : 0;
      tObj.correctCount += correct ? 1 : 0;
      tObj.power += award.power;
      tObj.score += award.points;

      if (team === 'A') s.teamAPower = award.power;
      else s.teamBPower = award.power;

      if (ansRecord) {
        extra.push(
          prisma.teamAnswer.updateMany({
            where: { matchTeamId: tObj.id, matchQuestionId: q.id },
            data: { pointsAwarded: award.points, powerAwarded: award.power },
          }),
        );
      }
    }

    const pull = calculateRound({
      ropePosition: s.ropePosition,
      teamAPower: s.teamAPower,
      teamBPower: s.teamBPower,
      pullMultiplier: s.settings.pullMultiplier,
      winThreshold: s.settings.winThreshold,
    });

    const result: RoundResult = {
      questionIndex: s.questionIndex,
      teamAPower: s.teamAPower,
      teamBPower: s.teamBPower,
      ropeBefore: pull.ropeBefore,
      ropeAfter: pull.ropeAfter,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    };
    s.rounds.push(result);

    this.schedule(room, s.settings.revealSeconds * 1000);
    this.syncPlayers(room);

    extra.push(
      prisma.matchRound.create({
        data: {
          matchId: s.id,
          matchQuestionId: q.id,
          teamAPower: s.teamAPower,
          teamBPower: s.teamBPower,
          ropeBefore: pull.ropeBefore,
          ropeAfter: pull.ropeAfter,
        },
      }),
      prisma.matchQuestion.update({ where: { id: q.id }, data: { status: 'REVEALED' } }),
    );

    await this.persist(room, extra);
  }

  private async finish(room: Internal) {
    this.stopTimer(room.state.code);
    room.state.phase = 'FINISHED';
    room.state.paused = false;
    room.state.locked = true;
    room.state.deadlineAt = null;
    room.state.winner = winnerAtEnd(room.state.ropePosition);
    room.state.finishedAt = new Date().toISOString();
    this.syncPlayers(room);
    await this.persist(room);
    this.io.to(room.state.code).emit('match:finished', this.serialize(room.state.code));
  }

  private async transition(room: Internal) {
    const s = room.state;
    if (s.paused || s.phase === 'FINISHED') return;

    switch (s.phase) {
      case 'COUNTDOWN':
        await this.beginQuestion(room);
        return;
      case 'QUESTION_ACTIVE':
        await this.reveal(room);
        return;
      case 'ANSWER_REVEAL':
        s.phase = 'PULL_ANIMATION';
        s.ropePosition = s.rounds.at(-1)?.ropeAfter || 0;
        this.schedule(room, s.settings.pullSeconds * 1000);
        break;
      case 'PULL_ANIMATION':
        s.phase = 'ROUND_RESULT';
        this.schedule(room, s.settings.resultSeconds * 1000);
        break;
      case 'ROUND_RESULT':
        if (
          s.settings.suddenDeath &&
          s.ropePosition === 0 &&
          s.questionIndex + 1 >= s.questionCount &&
          s.questionCount < room.snapshots.length
        ) {
          s.questionCount++;
        }

        if (
          Math.abs(s.ropePosition) >= s.settings.winThreshold ||
          s.questionIndex + 1 >= s.questionCount
        ) {
          await this.finish(room);
          return;
        }

        s.phase = 'NEXT_QUESTION';
        this.schedule(room, 300);
        break;
      case 'NEXT_QUESTION':
        s.questionIndex++;
        await this.beginQuestion(room);
        return;
      default:
        return;
    }

    this.syncPlayers(room);
    await this.persist(room);
  }

  async startMatch(code: string) {
    return this.run(code, async () => {
      const r = this.get(code);
      const s = r.state;

      const tA = s.teams.A;
      const tB = s.teams.B;
      if (!tA.connected || !tB.connected) {
        throw new Error('Kedua tim (Tim A dan Tim B) harus terhubung');
      }
      if (!tA.ready || !tB.ready) {
        throw new Error('Kedua tim harus menekan tombol READY');
      }
      if (tA.characters.length !== 3 || tB.characters.length !== 3) {
        throw new Error('Setiap tim harus memilih tepat 3 hero');
      }

      s.phase = 'COUNTDOWN';
      s.locked = true;
      s.startedAt = new Date().toISOString();
      this.schedule(r, s.settings.countdownSeconds * 1000);

      this.syncPlayers(r);
      await this.persist(r);
      return this.serialize(code);
    });
  }

  async host(code: string, action: string, payload: any = {}) {
    if (action === 'start-match') {
      return this.startMatch(code);
    }

    return this.run(code, async () => {
      const r = this.get(code);
      const s = r.state;
      const extra: Prisma.PrismaPromise<unknown>[] = [];

      switch (action) {
        case 'pause-match':
          if (lobby(s) || s.phase === 'FINISHED' || s.paused) {
            throw new Error('Pertandingan tidak dapat dijeda');
          }
          r.remainingMs = Math.max(0, (s.deadlineAt || Date.now()) - Date.now());
          this.stopTimer(code);
          s.deadlineAt = null;
          s.paused = true;
          break;

        case 'resume-match':
          if (!s.paused) throw new Error('Pertandingan tidak sedang dijeda');
          s.paused = false;
          this.schedule(r, Math.max(1, r.remainingMs));
          break;

        case 'next-question':
          if (s.paused) throw new Error('Lanjutkan pertandingan terlebih dahulu');
          if (
            !['ANSWER_REVEAL', 'PULL_ANIMATION', 'ROUND_RESULT', 'NEXT_QUESTION'].includes(s.phase)
          ) {
            throw new Error('Tunggu sampai jawaban diungkapkan');
          }
          this.stopTimer(code);
          await this.transition(r);
          return this.serialize(code);

        case 'end-match':
          if (s.phase === 'FINISHED') return this.serialize(code);
          await this.finish(r);
          return this.serialize(code);

        case 'reset-match':
          if (!lobby(s) && s.phase !== 'FINISHED') {
            throw new Error('Akhiri pertandingan sebelum mereset');
          }
          this.stopTimer(code);
          s.phase = 'WAITING';
          s.paused = false;
          s.locked = false;
          s.question = null;
          s.questionIndex = 0;
          s.deadlineAt = null;
          s.ropePosition = 0;
          s.teamAPower = 0;
          s.teamBPower = 0;
          s.winner = null;
          s.rounds = [];
          s.startedAt = null;
          s.finishedAt = null;
          delete s.correctAnswer;
          delete s.explanation;
          r.answers = {};
          r.scored = [];
          r.streaks = {};

          s.teams.A.ready = false;
          s.teams.A.score = 0;
          s.teams.A.power = 0;
          s.teams.A.correctCount = 0;
          s.teams.A.answered = false;

          s.teams.B.ready = false;
          s.teams.B.score = 0;
          s.teams.B.power = 0;
          s.teams.B.correctCount = 0;
          s.teams.B.answered = false;

          extra.push(
            prisma.teamAnswer.deleteMany({ where: { matchId: s.id } }),
            prisma.playerAnswer.deleteMany({ where: { matchId: s.id } }),
            prisma.matchRound.deleteMany({ where: { matchId: s.id } }),
            prisma.matchQuestion.updateMany({
              where: { matchId: s.id },
              data: { status: 'WAITING', startedAt: null, deadlineAt: null },
            }),
          );
          break;

        case 'lock-lobby':
          if (!lobby(s)) throw new Error('Pertandingan sudah dimulai');
          s.locked = payload.locked === undefined ? !s.locked : payload.locked;
          break;

        default:
          throw new Error('Aksi host tidak dikenal');
      }

      this.syncPlayers(r);
      await this.persist(r, extra);
      return this.serialize(code);
    });
  }
}

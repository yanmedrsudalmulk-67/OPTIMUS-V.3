import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../packages/database/client';
import { calculateAward, calculateRound, winnerAtEnd } from '../../../../packages/game-engine/src';
import {
  CHARACTERS,
  type RoomState,
  type Question,
  type Player,
  type Team,
  type RoundResult,
} from '../../../../packages/shared/src';
import { settings as parseSettings, matchSchema, joinSchema } from '../validation';
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
  private sockets = new Map<string, Set<string>>();
  constructor(private io: Server) {}
  async initialize() {
    const rows = await prisma.match.findMany({ include: { answers: true, players: true } });
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
      room.state.players = room.state.players.filter((p) =>
        row.players.some((saved) => saved.id === p.id),
      );
      for (const p of room.state.players) {
        p.connected = false;
        p.answered = !!room.answers[room.state.question?.id || '']?.[p.id];
      }
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
  serialize(code: string): RoomState {
    const room = this.get(code);
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
            )
              this.schedule(checkpoint, Math.max(1, checkpoint.state.deadlineAt - Date.now()));
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
  private async persist(
    room: Internal,
    extra: Prisma.PrismaPromise<unknown>[] = [],
    skipPlayers: string[] = [],
  ) {
    const s = room.state;
    await prisma.$transaction([
      prisma.match.update({
        where: { id: s.id },
        data: {
          phase: s.phase,
          paused: s.paused,
          locked: s.locked,
          ropePosition: s.ropePosition,
          winner: s.winner,
          state: json(room),
          startedAt: s.startedAt ? new Date(s.startedAt) : null,
          finishedAt: s.finishedAt ? new Date(s.finishedAt) : null,
        },
      }),
      ...s.players
        .filter((p) => !skipPlayers.includes(p.id))
        .map((p) =>
          prisma.matchPlayer.update({
            where: { id: p.id },
            data: {
              name: p.name,
              team: p.team,
              characterId: p.characterId,
              connected: p.connected,
              ready: p.ready,
              correctCount: p.correctCount,
              power: p.power,
              score: p.score,
              answered: p.answered,
            },
          }),
        ),
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
    if (!pack || !pack.active || !pack.questions.length)
      throw new Error('Paket harus memiliki soal aktif');
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
    const state: RoomState = {
      id,
      code,
      title: data.title,
      packageId: pack.id,
      packageName: pack.name,
      teamAName: data.teamAName,
      teamBName: data.teamBName,
      phase: 'WAITING',
      paused: false,
      locked: false,
      settings: config,
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
    await prisma.match.create({
      data: {
        id,
        code,
        title: data.title,
        packageId: pack.id,
        packageName: pack.name,
        teamAName: data.teamAName,
        teamBName: data.teamBName,
        phase: state.phase,
        settings: json(config),
        state: json(room),
        snapshots: json(snapshots),
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
    const data = joinSchema.parse(input);
    return this.run(data.code, async () => {
      const room = this.get(data.code);
      let player: Player | undefined;
      let token = data.token;
      const extra: Prisma.PrismaPromise<unknown>[] = [];
      const skip: string[] = [];
      if (token) {
        const prior = await prisma.matchPlayer.findUnique({
          where: { sessionHash: hashToken(token) },
        });
        if (!prior || prior.matchId !== room.state.id) throw new Error('Sesi pemain tidak valid');
        player = room.state.players.find((p) => p.id === prior.id);
        if (!player) throw new Error('Slot pemain sudah dihapus host');
      } else {
        if (!lobby(room.state) || room.state.locked) throw new Error('Lobby sudah dikunci');
        if (room.state.players.filter((p) => p.team === data.team).length >= 3)
          throw new Error('Tim sudah penuh');
        token = crypto.randomBytes(32).toString('hex');
        player = {
          id: crypto.randomUUID(),
          name: data.name,
          team: data.team,
          characterId: data.characterId,
          connected: true,
          ready: false,
          correctCount: 0,
          power: 0,
          score: 0,
          answered: false,
        };
        extra.push(
          prisma.matchPlayer.create({
            data: {
              id: player.id,
              matchId: room.state.id,
              name: player.name,
              team: player.team,
              characterId: player.characterId,
              sessionHash: hashToken(token),
              connected: true,
            },
          }),
        );
        skip.push(player.id);
        room.state.players.push(player);
      }
      player.connected = true;
      let connections = this.sockets.get(player.id);
      if (!connections) {
        connections = new Set();
        this.sockets.set(player.id, connections);
      }
      connections.add(socketId);
      this.updateLobby(room);
      await this.persist(room, extra, skip);
      return { token: token!, playerId: player.id, state: this.serialize(data.code) };
    });
  }
  async authenticatePlayer(token: string, code?: string) {
    const p = await prisma.matchPlayer.findUnique({ where: { sessionHash: hashToken(token) } });
    if (!p) throw new Error('Sesi pemain tidak valid');
    const room = [...this.rooms.values()].find((r) => r.state.id === p.matchId);
    if (
      !room ||
      (code && room.state.code !== code) ||
      !room.state.players.some((x) => x.id === p.id)
    )
      throw new Error('Pemain tidak ditemukan');
    return { playerId: p.id, code: room.state.code };
  }
  async reconnect(token: string, socketId: string) {
    const identity = await this.authenticatePlayer(token);
    const r = this.get(identity.code);
    const p = r.state.players.find((x) => x.id === identity.playerId)!;
    const result = await this.join(
      { code: identity.code, name: p.name, team: p.team, characterId: p.characterId, token },
      socketId,
    );
    return { ...identity, ...result };
  }
  async disconnect(playerId: string, code: string, socketId: string) {
    await this.run(code, async () => {
      const connections = this.sockets.get(playerId);
      connections?.delete(socketId);
      if (connections?.size) return;
      const room = this.get(code);
      const p = room.state.players.find((x) => x.id === playerId);
      if (p) {
        p.connected = false;
        this.updateLobby(room);
        await this.persist(room);
      }
    });
  }
  private player(room: Internal, id: string) {
    const p = room.state.players.find((p) => p.id === id);
    if (!p) throw new Error('Pemain tidak ditemukan');
    return p;
  }
  private updateLobby(room: Internal) {
    if (lobby(room.state))
      room.state.phase =
        room.state.players.length === 6 && room.state.players.every((p) => p.ready && p.connected)
          ? 'READY'
          : 'WAITING';
  }
  async ready(code: string, id: string, value: boolean) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Pertandingan sudah dimulai');
      this.player(r, id).ready = value;
      this.updateLobby(r);
      await this.persist(r);
      return this.serialize(code);
    });
  }
  async select(code: string, id: string, characterId: string, name?: string) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state)) throw new Error('Pertandingan sudah dimulai');
      if (!CHARACTERS.some((c) => c.id === characterId)) throw new Error('Karakter tidak valid');
      const p = this.player(r, id);
      p.characterId = characterId;
      if (name) p.name = name;
      p.ready = false;
      this.updateLobby(r);
      await this.persist(r);
      return this.serialize(code);
    });
  }
  async leave(code: string, id: string) {
    return this.run(code, async () => {
      const r = this.get(code);
      if (!lobby(r.state))
        throw new Error('Slot tidak dapat dilepas saat pertandingan berlangsung');
      r.state.players = r.state.players.filter((p) => p.id !== id);
      this.sockets.delete(id);
      this.updateLobby(r);
      await this.persist(r, [prisma.matchPlayer.delete({ where: { id } })]);
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
    if (!room.state.paused)
      this.timers.set(
        room.state.code,
        setTimeout(() => {
          void this.run(room.state.code, async () => {
            if (room.state.deadlineAt === deadline && room.state.phase === phase)
              await this.transition(room);
          }).catch((e) => console.error('Phase transition failed', e));
        }, ms),
      );
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
    s.players.forEach((p) => (p.answered = false));
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
  async answer(code: string, id: string, questionId: string, answer: number) {
    return this.run(code, async () => {
      const room = this.get(code);
      const s = room.state;
      const p = this.player(room, id);
      if (
        s.paused ||
        s.phase !== 'QUESTION_ACTIVE' ||
        s.question?.id !== questionId ||
        !s.deadlineAt ||
        Date.now() >= s.deadlineAt
      )
        throw new Error('Waktu menjawab sudah berakhir');
      if (p.answered || room.answers[questionId]?.[id]) throw new Error('Jawaban sudah dikirim');
      const responseTimeMs = Math.max(0, s.question.duration * 1000 - (s.deadlineAt - Date.now()));
      const q = room.snapshots[s.questionIndex];
      const answerWrite = prisma.playerAnswer.create({
        data: {
          matchId: s.id,
          matchQuestionId: questionId,
          playerId: id,
          selectedAnswer: answer,
          isCorrect: answer === q.correctAnswer,
          responseTimeMs,
        },
      });
      (room.answers[questionId] ||= {})[id] = { answer, responseTimeMs };
      p.answered = true;
      await this.persist(room, [answerWrite]);
      if (s.settings.autoClose && s.players.length === 6 && s.players.every((p) => p.answered)) {
        this.stopTimer(code);
        this.timers.set(
          code,
          setTimeout(() => {
            void this.run(code, async () => {
              const current = this.get(code);
              if (current.state.phase === 'QUESTION_ACTIVE' && !current.state.paused)
                await this.reveal(current);
            }).catch((e) => console.error('Auto-close failed', e));
          }, 0),
        );
      }
      return { accepted: true };
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
    for (const p of s.players) {
      const a = room.answers[q.id]?.[p.id];
      const correct = !!a && a.answer === q.correctAnswer;
      const award = calculateAward({
        correct,
        points: q.points,
        baseCorrectPower: s.settings.baseCorrectPower,
        responseTimeMs: a?.responseTimeMs || 0,
        durationMs: (s.settings.duration || q.duration) * 1000,
        streak: room.streaks[p.id] || 0,
        speedBonus: s.settings.speedBonus,
        comboBonus: s.settings.comboBonus,
      });
      room.streaks[p.id] = correct ? (room.streaks[p.id] || 0) + 1 : 0;
      p.correctCount += correct ? 1 : 0;
      p.power += award.power;
      p.score += award.points;
      if (p.team === 'A') s.teamAPower += award.power;
      else s.teamBPower += award.power;
      if (a)
        extra.push(
          prisma.playerAnswer.update({
            where: { playerId_matchQuestionId: { playerId: p.id, matchQuestionId: q.id } },
            data: { pointsAwarded: award.points, powerAwarded: award.power },
          }),
        );
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
        )
          s.questionCount++;
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
    await this.persist(room);
  }
  async host(code: string, action: string, payload: any = {}) {
    return this.run(code, async () => {
      const r = this.get(code);
      const s = r.state;
      const extra: Prisma.PrismaPromise<unknown>[] = [];
      switch (action) {
        case 'start-match':
          if (
            s.phase !== 'READY' ||
            s.players.length !== 6 ||
            s.players.some((p) => !p.ready || !p.connected) ||
            ['A', 'B'].some((t) => s.players.filter((p) => p.team === t).length !== 3)
          )
            throw new Error('Enam pemain (tiga per tim) harus terhubung dan siap');
          s.phase = 'COUNTDOWN';
          s.locked = true;
          s.startedAt = new Date().toISOString();
          this.schedule(r, s.settings.countdownSeconds * 1000);
          break;
        case 'pause-match':
          if (lobby(s) || s.phase === 'FINISHED' || s.paused)
            throw new Error('Pertandingan tidak dapat dijeda');
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
          )
            throw new Error('Tunggu sampai jawaban diungkapkan');
          this.stopTimer(code);
          await this.transition(r);
          return this.serialize(code);
        case 'end-match':
          if (s.phase === 'FINISHED') return this.serialize(code);
          await this.finish(r);
          return this.serialize(code);
        case 'reset-match':
          if (!lobby(s) && s.phase !== 'FINISHED')
            throw new Error('Akhiri pertandingan sebelum mereset');
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
          s.players.forEach((p) => {
            p.ready = false;
            p.score = 0;
            p.power = 0;
            p.correctCount = 0;
            p.answered = false;
          });
          extra.push(
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
        case 'move-player': {
          if (!lobby(s) || s.locked) throw new Error('Lobby terkunci');
          const p = this.player(r, payload.playerId);
          const team = payload.team as Team;
          if (!['A', 'B'].includes(team)) throw new Error('Tim tidak valid');
          if (p.team !== team && s.players.filter((x) => x.team === team).length >= 3)
            throw new Error('Tim tujuan penuh');
          p.team = team;
          p.ready = false;
          this.updateLobby(r);
          break;
        }
        case 'kick-player': {
          if (!lobby(s)) throw new Error('Pertandingan sudah dimulai');
          const p = this.player(r, payload.playerId);
          s.players = s.players.filter((x) => x.id !== p.id);
          this.sockets.delete(p.id);
          extra.push(prisma.matchPlayer.delete({ where: { id: p.id } }));
          this.updateLobby(r);
          break;
        }
        default:
          throw new Error('Aksi host tidak dikenal');
      }
      await this.persist(r, extra);
      return this.serialize(code);
    });
  }
}

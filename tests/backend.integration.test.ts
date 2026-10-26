import 'dotenv/config';
import { afterAll, describe, expect, test } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { Ack, JoinResult, RoomState } from '../packages/shared/src';
const base = process.env.TEST_API_URL || 'http://127.0.0.1:4001';
const sockets: Socket[] = [];
let cookie = '';
let packageId = '';
const packageIds: string[] = [];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function rest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(base + '/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data as T;
}
async function connect(admin = false, token?: string) {
  const socket = io(base, {
    forceNew: true,
    transports: ['websocket'],
    extraHeaders: admin ? { Cookie: cookie } : {},
    auth: token ? { playerToken: token } : {},
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}
async function emit<T = unknown>(socket: Socket, event: string, payload: unknown) {
  return new Promise<Ack<T>>((resolve, reject) =>
    socket
      .timeout(5000)
      .emit(event, payload, (error: Error | null, response: Ack<T>) =>
        error ? reject(error) : resolve(response),
      ),
  );
}
async function state(code: string, predicate: (s: RoomState) => boolean, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await rest<RoomState>('/rooms/' + code);
    if (predicate(s)) return s;
    await pause(40);
  }
  throw new Error('Timed out waiting for room state');
}

describe.runIf(process.env.RUN_INTEGRATION === '1')(
  'real PostgreSQL + Socket.IO multiplayer integration',
  () => {
    afterAll(async () => {
      sockets.forEach((s) => s.disconnect());
      for (const id of packageIds) await rest('/packages/' + id, { method: 'DELETE' });
    });
    test('auth, question snapshots, 6-player capacity, pause, recovery, scoring, deadline, and history', async () => {
      expect((await rest<{ status: string }>('/health')).status).toBe('ok');
      const protectedResponse = await fetch(base + '/api/packages');
      expect(protectedResponse.status).toBe(401);
      const login = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
        }),
      });
      expect(login.status).toBe(200);
      cookie = login.headers.getSetCookie()[0].split(';')[0];
      const pack = await rest<{ id: string }>('/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'QA integration ' + Date.now(),
          description: 'Integration fixture',
        }),
      });
      packageId = pack.id;
      packageIds.push(pack.id);
      const questionIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const q = await rest<{ id: string }>('/questions', {
          method: 'POST',
          body: JSON.stringify({
            packageId,
            text: 'Pertanyaan snapshot ' + i,
            options: ['Benar', 'Salah', 'Alternatif', 'Lainnya'],
            correctAnswer: 0,
            explanation: 'Penjelasan asli ' + i,
            duration: 2,
            points: 100,
            active: true,
            sortOrder: i,
          }),
        });
        questionIds.push(q.id);
      }
      const created = await rest<RoomState>('/matches', {
        method: 'POST',
        body: JSON.stringify({
          title: 'QA enam pemain ' + Date.now(),
          teamAName: 'QA Emerald',
          teamBName: 'QA Sapphire',
          packageId,
          settings: {
            questionCount: 2,
            duration: 2,
            countdownSeconds: 0.1,
            revealSeconds: 0.3,
            pullSeconds: 0.3,
            resultSeconds: 0.2,
            autoClose: true,
          },
        }),
      });
      expect(created.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(created.questionCount).toBe(2);
      expect(created.question).toBeNull();
      const code = created.code;
      const host = await connect(true);
      const outsider = await connect();
      expect((await emit(outsider, 'host:start-match', { code })).ok).toBe(false);
      expect((await emit(host, 'host:start-match', { code })).ok).toBe(false);
      const players: Socket[] = [];
      const joins: JoinResult[] = [];
      for (let i = 0; i < 6; i++) {
        const socket = await connect();
        players.push(socket);
        const result = await emit<JoinResult>(socket, 'room:join', {
          code,
          name: 'QA Player ' + i,
          team: i < 3 ? 'A' : 'B',
          characterId: i % 2 ? 'nurse-f' : 'doctor-m',
        });
        expect(result.ok).toBe(true);
        joins.push(result.data!);
      }
      expect(
        (
          await emit(outsider, 'room:join', {
            code,
            name: 'Extra Player',
            team: 'A',
            characterId: 'doctor-m',
          })
        ).ok,
      ).toBe(false);
      for (const player of players)
        expect((await emit(player, 'player:set-ready', { code, ready: true })).ok).toBe(true);
      const ready = await state(code, (s) => s.phase === 'READY');
      expect(ready.players).toHaveLength(6);
      await rest('/questions/' + questionIds[0], {
        method: 'PATCH',
        body: JSON.stringify({ text: 'Pertanyaan diubah setelah snapshot', correctAnswer: 3 }),
      });
      expect((await emit(host, 'host:start-match', { code })).ok).toBe(true);
      const active = await state(code, (s) => s.phase === 'QUESTION_ACTIVE');
      expect(active.question?.text).toBe('Pertanyaan snapshot 0');
      expect(active.correctAnswer).toBeUndefined();
      expect((active.question as any).correctAnswer).toBeUndefined();
      expect((await emit(host, 'host:pause-match', { code })).ok).toBe(true);
      const paused = await state(code, (s) => s.paused);
      expect(paused.deadlineAt).toBeNull();
      await pause(150);
      expect(
        (
          await emit(players[0], 'player:submit-answer', {
            code,
            questionId: active.question!.id,
            answer: 0,
          })
        ).ok,
      ).toBe(false);
      expect((await emit(host, 'host:resume-match', { code })).ok).toBe(true);
      expect(
        (
          await emit(players[0], 'player:submit-answer', {
            code,
            questionId: active.question!.id,
            answer: 0,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await emit(players[0], 'player:submit-answer', {
            code,
            questionId: active.question!.id,
            answer: 0,
          })
        ).ok,
      ).toBe(false);
      players[0].disconnect();
      await state(
        code,
        (s) => s.players.find((p) => p.id === joins[0].playerId)?.connected === false,
      );
      players[0] = await connect(false, joins[0].token);
      const rejoined = await emit<JoinResult>(players[0], 'room:join', {
        code,
        name: 'QA Player 0',
        team: 'A',
        characterId: 'doctor-m',
        token: joins[0].token,
      });
      expect(rejoined.ok).toBe(true);
      expect(rejoined.data?.playerId).toBe(joins[0].playerId);
      expect(rejoined.data?.state.players).toHaveLength(6);
      expect(rejoined.data?.state.players.find((p) => p.id === joins[0].playerId)?.answered).toBe(
        true,
      );
      for (let i = 1; i < 6; i++)
        expect(
          (
            await emit(players[i], 'player:submit-answer', {
              code,
              questionId: active.question!.id,
              answer: i < 3 ? 0 : 1,
            })
          ).ok,
        ).toBe(true);
      const reveal = await state(code, (s) => s.phase === 'ANSWER_REVEAL');
      expect(reveal.correctAnswer).toBe(0);
      expect(reveal.teamAPower).toBe(30);
      expect(reveal.teamBPower).toBe(0);
      expect(reveal.rounds[0].ropeAfter).toBe(-45);
      const second = await state(
        code,
        (s) => s.phase === 'QUESTION_ACTIVE' && s.questionIndex === 1,
      );
      expect(second.correctAnswer).toBeUndefined();
      for (let i = 0; i < 5; i++)
        expect(
          (
            await emit(players[i], 'player:submit-answer', {
              code,
              questionId: second.question!.id,
              answer: i < 3 ? 0 : 1,
            })
          ).ok,
        ).toBe(true);
      await state(code, (s) => s.questionIndex === 1 && s.phase === 'ANSWER_REVEAL');
      expect(
        (
          await emit(players[5], 'player:submit-answer', {
            code,
            questionId: second.question!.id,
            answer: 0,
          })
        ).ok,
      ).toBe(false);
      const finished = await state(code, (s) => s.phase === 'FINISHED');
      expect(finished.winner).toBe('A');
      expect(finished.ropePosition).toBe(-90);
      expect(finished.rounds).toHaveLength(2);
      expect(finished.players.filter((p) => p.team === 'A').every((p) => p.score === 200)).toBe(
        true,
      );
      const history = await rest<RoomState & { answers: unknown[] }>('/matches/' + created.id);
      expect(history.winner).toBe('A');
      expect(history.answers).toHaveLength(11);
      const list = await rest<RoomState[]>('/matches');
      expect(list.some((m) => m.id === created.id && m.phase === 'FINISHED')).toBe(true);
    }, 30000);
    test('per-question timing and finite sudden-death reserves work', async () => {
      const pack = await rest<{ id: string }>('/packages', {
        method: 'POST',
        body: JSON.stringify({ name: 'QA reserves ' + Date.now() }),
      });
      packageIds.push(pack.id);
      for (let i = 0; i < 2; i++)
        await rest('/questions', {
          method: 'POST',
          body: JSON.stringify({
            packageId: pack.id,
            text: 'Cadangan ' + i,
            options: ['Benar', 'Salah', 'C', 'D'],
            correctAnswer: 0,
            duration: 1,
            points: 50,
            active: true,
            sortOrder: i,
          }),
        });
      const created = await rest<RoomState>('/matches', {
        method: 'POST',
        body: JSON.stringify({
          title: 'QA sudden death ' + Date.now(),
          teamAName: 'Hijau',
          teamBName: 'Biru',
          packageId: pack.id,
          settings: {
            questionCount: 1,
            duration: 0,
            suddenDeath: true,
            countdownSeconds: 0.1,
            revealSeconds: 0.1,
            pullSeconds: 0.1,
            resultSeconds: 0.1,
          },
        }),
      });
      const code = created.code;
      const host = await connect(true);
      const players: Socket[] = [];
      for (let i = 0; i < 6; i++) {
        const player = await connect();
        players.push(player);
        expect(
          (
            await emit(player, 'room:join', {
              code,
              name: 'Reserve ' + i,
              team: i < 3 ? 'A' : 'B',
              characterId: 'doctor-m',
            })
          ).ok,
        ).toBe(true);
        await emit(player, 'player:set-ready', { code, ready: true });
      }
      expect((await emit(host, 'host:start-match', { code })).ok).toBe(true);
      const first = await state(code, (s) => s.phase === 'QUESTION_ACTIVE');
      expect(first.question?.duration).toBe(1);
      expect(first.questionCount).toBe(1);
      for (const player of players)
        await emit(player, 'player:submit-answer', {
          code,
          questionId: first.question!.id,
          answer: 0,
        });
      const reserve = await state(
        code,
        (s) => s.phase === 'QUESTION_ACTIVE' && s.questionIndex === 1,
      );
      expect(reserve.questionCount).toBe(2);
      for (let i = 0; i < 6; i++)
        await emit(players[i], 'player:submit-answer', {
          code,
          questionId: reserve.question!.id,
          answer: i < 3 ? 0 : 1,
        });
      const finished = await state(code, (s) => s.phase === 'FINISHED');
      expect(finished.rounds).toHaveLength(2);
      expect(finished.winner).toBe('A');
      expect(finished.ropePosition).toBe(-45);
    }, 15000);
    test('import is validated before commit and CSV export is authenticated', async () => {
      const pack = await rest<{ id: string }>('/packages', {
        method: 'POST',
        body: JSON.stringify({ name: 'QA import ' + Date.now() }),
      });
      packageIds.push(pack.id);
      const row = {
        package: pack.id,
        question: 'Pertanyaan impor valid',
        option_a: 'Pilihan A',
        option_b: 'Pilihan B',
        option_c: 'Pilihan C',
        option_d: 'Pilihan D',
        correct_answer: 'B',
        explanation: 'Penjelasan',
        duration: 15,
        points: 100,
      };
      const bad = await rest<{ imported: number; errors: { row: number }[] }>('/questions/import', {
        method: 'POST',
        body: JSON.stringify({ rows: [row, { ...row, correct_answer: 'Z' }], commit: true }),
      });
      expect(bad.imported).toBe(0);
      expect(bad.errors[0].row).toBe(3);
      const preview = await rest<{ valid: unknown[]; imported: number; errors: unknown[] }>(
        '/questions/import',
        { method: 'POST', body: JSON.stringify({ rows: [row], commit: false }) },
      );
      expect(preview.valid).toHaveLength(1);
      expect(preview.imported).toBe(0);
      const committed = await rest<{ imported: number }>('/questions/import', {
        method: 'POST',
        body: JSON.stringify({ rows: [row], commit: true }),
      });
      expect(committed.imported).toBe(1);
      const packages = await rest<{ id: string; questions: { id: string }[] }[]>('/packages');
      const question = packages.find((p) => p.id === pack.id)!.questions[0];
      expect(
        (await rest<{ id: string }>('/questions/' + question.id + '/duplicate', { method: 'POST' }))
          .id,
      ).not.toBe(question.id);
      expect((await fetch(base + '/api/questions/export')).status).toBe(401);
      const csv = await fetch(base + '/api/questions/export?format=csv&packageId=' + pack.id, {
        headers: { Cookie: cookie },
      });
      expect(csv.status).toBe(200);
      expect(await csv.text()).toContain('Pertanyaan impor valid');
      const xlsx = await fetch(base + '/api/questions/template?format=xlsx', {
        headers: { Cookie: cookie },
      });
      expect(xlsx.status).toBe(200);
      expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
      const fake = new FormData();
      fake.set('image', new Blob(['not a real PNG'], { type: 'image/png' }), 'fake.png');
      const upload = await fetch(base + '/api/uploads', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: fake,
      });
      expect(upload.status).toBe(400);
    }, 15000);
    test('CSRF origins, forged socket host identity, and multipart limits are enforced', async () => {
      const csrf = await fetch(base + '/api/settings', {
        method: 'PUT',
        headers: {
          Cookie: cookie,
          Origin: 'https://malicious.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(csrf.status).toBe(403);
      const cors = await fetch(base + '/api/auth/me', {
        headers: { Cookie: cookie, Origin: 'https://malicious.example' },
      });
      expect(cors.headers.get('access-control-allow-origin')).toBeNull();
      const rejected = io(base, {
        forceNew: true,
        reconnection: false,
        transports: ['websocket'],
        extraHeaders: { Origin: 'https://malicious.example' },
        timeout: 1500,
      });
      sockets.push(rejected);
      const socketOutcome = await new Promise<string>((resolve) => {
        rejected.once('connect', () => resolve('connected'));
        rejected.once('connect_error', () => resolve('rejected'));
      });
      expect(socketOutcome).toBe('rejected');
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII=',
        'base64',
      );
      const valid = new FormData();
      valid.set('image', new Blob([png], { type: 'image/png' }), 'pixel.png');
      const upload = await fetch(base + '/api/uploads', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: valid,
      });
      expect(upload.status).toBe(201);
      const saved = await upload.json();
      expect(saved.url).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);
      const extra = new FormData();
      extra.set('unexpected', 'field');
      extra.set('image', new Blob([png], { type: 'image/png' }), 'pixel.png');
      expect(
        (
          await fetch(base + '/api/uploads', {
            method: 'POST',
            headers: { Cookie: cookie },
            body: extra,
          })
        ).status,
      ).toBe(400);
      const oversized = new FormData();
      oversized.set(
        'image',
        new Blob([png, new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' }),
        'big.png',
      );
      expect(
        (
          await fetch(base + '/api/uploads', {
            method: 'POST',
            headers: { Cookie: cookie },
            body: oversized,
          })
        ).status,
      ).toBe(400);
    }, 15000);
  },
);

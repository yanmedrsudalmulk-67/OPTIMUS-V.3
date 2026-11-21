import 'dotenv/config';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client } from 'pg';
import { io, type Socket } from 'socket.io-client';
import { afterAll, describe, expect, test } from 'vitest';
import type { Ack, JoinResult, RoomState } from '../packages/shared/src';
const enabled = process.env.RUN_RESTART_INTEGRATION === '1' || process.env.RUN_RESTART === '1';
const databaseName = 'medical_restart_' + crypto.randomBytes(6).toString('hex');
let control: Client | undefined;
let instance: ChildProcess | undefined;
let created = false;
let cookie = '';
const sockets: Socket[] = [];
const base = 'http://127.0.0.1:4002';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let testEnvironment: NodeJS.ProcessEnv;
async function script(filename: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', filename], {
      env: testEnvironment,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Isolated setup command failed: ' + filename)),
    );
  });
}
async function start() {
  instance = spawn(process.execPath, ['--import', 'tsx', 'apps/realtime-server/src/index.ts'], {
    env: testEnvironment,
    stdio: 'ignore',
  });
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (instance.exitCode !== null) throw new Error('Isolated API exited during startup');
    try {
      if ((await fetch(base + '/api/health')).ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error('Isolated API readiness timed out');
}
async function stop() {
  if (!instance) return;
  const child = instance;
  instance = undefined;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}
async function request<T>(path: string, options: RequestInit = {}) {
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
async function connect(admin = false) {
  const socket = io(base, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
    extraHeaders: admin ? { Cookie: cookie } : {},
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
      .timeout(3000)
      .emit(event, payload, (error: Error | null, ack: Ack<T>) =>
        error ? reject(error) : resolve(ack),
      ),
  );
}
async function room(code: string, predicate: (s: RoomState) => boolean) {
  for (let i = 0; i < 200; i++) {
    const current = await request<RoomState>('/rooms/' + code);
    if (predicate(current)) return current;
    await delay(25);
  }
  throw new Error('Isolated room state timed out');
}

describe.runIf(enabled)('real API process restart on isolated PostgreSQL database', () => {
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await stop();
    if (control) {
      if (created) await control.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await control.end();
    }
  });
  test('paused timer, accepted answer, player identity and finished history survive process restarts', async () => {
    if (!process.env.DATABASE_URL || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)
      throw new Error('Development DATABASE_URL and administrator environment are required');
    const databaseUrl = new URL(process.env.DATABASE_URL);
    databaseUrl.pathname = '/' + databaseName;
    testEnvironment = {
      ...process.env,
      DATABASE_URL: databaseUrl.toString(),
      API_PORT: '4002',
      COOKIE_SECURE: 'false',
    };
    control = new Client({ connectionString: process.env.DATABASE_URL });
    await control.connect();
    await control.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await script('scripts/migrate.ts');
    await script('packages/database/seed.ts');
    await script('scripts/create-admin.ts');
    await start();
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
    const packs =
      await request<
        { id: string; questions: { id: string; text: string; correctAnswer: number }[] }[]
      >('/packages');
    expect(packs).toHaveLength(5);
    expect(packs.every((p) => p.questions.length >= 5)).toBe(true);
    const match = await request<RoomState>('/matches', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Isolated restart verification',
        packageId: packs[0].id,
        teamAName: 'Tim Hijau',
        teamBName: 'Tim Biru',
        settings: {
          questionCount: 1,
          duration: 8,
          countdownSeconds: 0.1,
          revealSeconds: 0.1,
          pullSeconds: 0.1,
          resultSeconds: 0.1,
        },
      }),
    });
    const original = packs[0].questions[0];
    await request('/questions/' + original.id, {
      method: 'PATCH',
      body: JSON.stringify({
        text: 'Bank diperbarui setelah snapshot',
        correctAnswer: (original.correctAnswer + 1) % 4,
      }),
    });
    const code = match.code;
    let host = await connect(true);
    let players: Socket[] = [];
    const identities: JoinResult[] = [];
    for (let i = 0; i < 6; i++) {
      const player = await connect();
      players.push(player);
      const joined = await emit<JoinResult>(player, 'room:join', {
        code,
        name: 'Restart Player ' + i,
        team: i < 3 ? 'A' : 'B',
        characterId: 'doctor-m',
      });
      expect(joined.ok).toBe(true);
      identities.push(joined.data!);
      await emit(player, 'player:set-ready', { code, ready: true });
    }
    await emit(host, 'host:start-match', { code });
    const active = await room(code, (s) => s.phase === 'QUESTION_ACTIVE');
    const correct = original.correctAnswer;
    expect(active.question?.text).toBe(original.text);
    expect(JSON.stringify(active)).not.toContain('"correctAnswer"');
    expect(
      (
        await emit(players[0], 'player:submit-answer', {
          code,
          questionId: active.question!.id,
          answer: correct,
        })
      ).ok,
    ).toBe(true);
    expect((await emit(host, 'host:pause-match', { code })).ok).toBe(true);
    const paused = await room(code, (s) => s.paused);
    expect(paused.players[0].answered).toBe(true);
    await stop();
    await delay(150);
    await start();
    const restored = await request<RoomState>('/rooms/' + code);
    expect(restored.paused).toBe(true);
    expect(restored.question?.text).toBe(original.text);
    expect(JSON.stringify(restored)).not.toContain('"correctAnswer"');
    expect(restored.question?.id).toBe(active.question?.id);
    expect(restored.players).toHaveLength(6);
    expect(restored.players.find((p) => p.id === identities[0].playerId)?.answered).toBe(true);
    expect(restored.players.every((p) => !p.connected)).toBe(true);
    host = await connect(true);
    players = [];
    for (let i = 0; i < 6; i++) {
      const player = await connect();
      players.push(player);
      const result = await emit<JoinResult>(player, 'room:join', {
        code,
        name: 'Restart Player ' + i,
        team: i < 3 ? 'A' : 'B',
        characterId: 'doctor-m',
        token: identities[i].token,
      });
      expect(result.ok).toBe(true);
      expect(result.data?.playerId).toBe(identities[i].playerId);
    }
    expect((await emit(host, 'host:resume-match', { code })).ok).toBe(true);
    const resumed = await room(code, (s) => !s.paused);
    expect(resumed.deadlineAt! - Date.now()).toBeGreaterThan(6000);
    expect(
      (
        await emit(players[0], 'player:submit-answer', {
          code,
          questionId: active.question!.id,
          answer: correct,
        })
      ).ok,
    ).toBe(false);
    for (let i = 1; i < 6; i++)
      expect(
        (
          await emit(players[i], 'player:submit-answer', {
            code,
            questionId: active.question!.id,
            answer: i < 3 ? correct : (correct + 1) % 4,
          })
        ).ok,
      ).toBe(true);
    const finished = await room(code, (s) => s.phase === 'FINISHED');
    expect(finished.winner).toBe('A');
    expect(finished.ropePosition).toBe(-45);
    await stop();
    await start();
    const history = await request<RoomState & { answers: unknown[] }>('/matches/' + match.id);
    expect(history.phase).toBe('FINISHED');
    expect(history.winner).toBe('A');
    expect(history.rounds).toHaveLength(1);
    expect(history.answers).toHaveLength(6);
    expect(
      history.players
        .filter((p) => p.team === 'A')
        .every((p) => p.score === 100 && p.correctCount === 1),
    ).toBe(true);
    const persisted =
      await request<{ id: string; questions: { id: string; text: string }[] }[]>('/packages');
    expect(persisted).toHaveLength(5);
    expect(persisted[0].questions.find((q) => q.id === original.id)?.text).toBe(
      'Bank diperbarui setelah snapshot',
    );
  }, 45000);
});

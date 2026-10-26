import { Router } from 'express';
import { prisma } from '../../../../packages/database/client';
import { settings } from '../validation';
import type { GameService } from '../services/game';
export function adminRouter(game: GameService) {
  const router = Router();
  router.get('/dashboard', async (_req, res) => {
    const matches = game.all();
    res.json({
      totalMatches: matches.length,
      totalPlayers: await prisma.matchPlayer.count(),
      totalQuestions: await prisma.question.count(),
      activeMatches: matches.filter((m) => m.phase !== 'FINISHED').length,
      completedMatches: matches.filter((m) => m.phase === 'FINISHED').length,
      matches: matches.slice(0, 8),
    });
  });
  router.get('/settings', async (_req, res) => {
    const row = await prisma.gameSetting.findUnique({ where: { id: 'default' } });
    res.json(settings(row?.value));
  });
  router.put('/settings', async (req, res) => {
    const value = settings(req.body);
    await prisma.gameSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', value: JSON.parse(JSON.stringify(value)) },
      update: { value: JSON.parse(JSON.stringify(value)) },
    });
    res.json(value);
  });
  router.get('/matches', (_req, res) => res.json(game.all()));
  router.get('/matches/:id', async (req, res) => {
    const state = game.getById(String(req.params.id));
    const answers =
      state.phase === 'FINISHED'
        ? await prisma.playerAnswer.findMany({
            where: { matchId: state.id },
            select: {
              id: true,
              playerId: true,
              matchQuestionId: true,
              selectedAnswer: true,
              isCorrect: true,
              pointsAwarded: true,
              powerAwarded: true,
              responseTimeMs: true,
            },
          })
        : [];
    res.json({ ...state, answers });
  });
  router.post('/matches', async (req, res) => res.status(201).json(await game.create(req.body)));
  router.get('/leaderboard', async (_req, res) => {
    const players = await prisma.matchPlayer.findMany({
      where: { match: { phase: 'FINISHED' } },
      orderBy: [{ score: 'desc' }, { correctCount: 'desc' }],
      take: 200,
    });
    res.json(
      players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        score: p.score,
        correctCount: p.correctCount,
        power: p.power,
        matches: 1,
      })),
    );
  });
  return router;
}

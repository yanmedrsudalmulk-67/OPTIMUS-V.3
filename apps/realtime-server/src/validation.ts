import { z } from 'zod';
import { CHARACTERS, DEFAULT_SETTINGS } from '../../../packages/shared/src';
export const settingsSchema = z.object({
  questionCount: z.number().int().min(1).max(200),
  duration: z.number().min(0).max(600),
  shuffle: z.boolean(),
  countdownSeconds: z.number().min(0.1).max(30),
  revealSeconds: z.number().min(0.1).max(30),
  pullSeconds: z.number().min(0.1).max(30),
  resultSeconds: z.number().min(0.1).max(30),
  baseCorrectPower: z.number().min(1).max(1000),
  pullMultiplier: z.number().min(0.01).max(100),
  winThreshold: z.number().min(1).max(10000),
  speedBonus: z.boolean(),
  comboBonus: z.boolean(),
  autoClose: z.boolean(),
  suddenDeath: z.boolean(),
  arena: z.enum(['hospital', 'fantasy']),
  quality: z.enum(['AUTO', 'LOW', 'MEDIUM', 'HIGH']),
  particles: z.boolean(),
  sound: z.boolean(),
  music: z.boolean(),
  volume: z.number().min(0).max(1),
  cameraMotion: z.boolean(),
});
export function settings(value: unknown) {
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...((value as object) || {}) });
}
export const questionSchema = z.object({
  packageId: z.string().min(1),
  text: z.string().trim().min(3).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().max(4000).default(''),
  imageUrl: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .refine((v) => !v || v.startsWith('/uploads/'), 'Gambar harus berasal dari unggahan aplikasi'),
  duration: z.number().int().min(1).max(600).default(20),
  points: z.number().int().min(1).max(10000).default(100),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});
export const packageSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().max(1000).default(''),
  active: z.boolean().default(true),
});
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'Kode room harus 6 karakter');
export const joinSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2).max(30),
  team: z.enum(['A', 'B']),
  characterId: z
    .string()
    .refine((id) => CHARACTERS.some((c) => c.id === id), 'Karakter tidak valid'),
  token: z.string().max(200).optional(),
});
export const matchSchema = z.object({
  title: z.string().trim().min(3).max(150),
  teamAName: z.string().trim().min(1).max(40),
  teamBName: z.string().trim().min(1).max(40),
  packageId: z.string().min(1),
  settings: settingsSchema.partial().optional(),
});
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return error instanceof Error ? error.message : 'Terjadi kesalahan';
}

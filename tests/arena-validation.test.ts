import { describe, expect, it } from 'vitest';
import { quickMatchSchema, settings } from '../apps/realtime-server/src/validation';

describe('Arena theme validation', () => {
  it('accepts hospital, fantasy, and beach arenas', () => {
    expect(settings({ arena: 'hospital' }).arena).toBe('hospital');
    expect(settings({ arena: 'fantasy' }).arena).toBe('fantasy');
    expect(settings({ arena: 'beach' }).arena).toBe('beach');
  });

  it('allows creating a quick match with beach arena', () => {
    const parsed = quickMatchSchema.parse({
      teamAName: 'Tim Hijau',
      teamBName: 'Tim Biru',
      settings: { arena: 'beach', questionCount: 5 },
    });
    expect(parsed.settings?.arena).toBe('beach');
  });

  it('rejects unknown arena themes', () => {
    expect(() => settings({ arena: 'volcano' })).toThrow();
  });
});

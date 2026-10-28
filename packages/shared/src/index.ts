export type Team = 'A' | 'B';
export type Phase =
  | 'WAITING'
  | 'READY'
  | 'COUNTDOWN'
  | 'QUESTION_ACTIVE'
  | 'ANSWER_REVEAL'
  | 'PULL_ANIMATION'
  | 'ROUND_RESULT'
  | 'NEXT_QUESTION'
  | 'FINISHED';
export type Quality = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
export interface CharacterAttributes {
  care: number;
  teamwork: number;
  knowledge: number;
  resilience: number;
}
export interface CharacterDefinition {
  id: string;
  name: string;
  title: string;
  profession: string;
  color: string;
  accent: string;
  accessory: string;
  description: string;
  thumbnailPath: string;
  attributes: CharacterAttributes;
  preview: { kind: 'procedural' | 'gltf'; facing: number };
  modelPath?: string;
  animationConfig: {
    idle: string;
    selected: string;
    victory: string;
    scale: number;
  };
}

// Presentation traits never enter scoring. Keep IDs stable: saved rooms and
// both team controllers reference these definitions directly.
function defineCharacter(
  hero: Omit<CharacterDefinition, 'accent' | 'thumbnailPath' | 'preview' | 'animationConfig'>,
): CharacterDefinition {
  return {
    ...hero,
    accent: hero.color,
    thumbnailPath: `/heroes/${hero.id}.webp`,
    preview: { kind: hero.modelPath ? 'gltf' : 'procedural', facing: -0.12 },
    animationConfig: { idle: 'idle', selected: 'ready', victory: 'victory', scale: 1 },
  };
}

export const CHARACTERS: CharacterDefinition[] = [
  defineCharacter({
    id: 'doctor-m',
    modelPath: '/models/doctor-hero.glb',
    name: 'Dr. Arga',
    title: 'DOCTOR',
    profession: 'Dokter Pria',
    color: '#38bdf8',
    accessory: 'stethoscope',
    description:
      'Tenang dalam mengambil keputusan, teliti membaca gejala, dan selalu mengutamakan keselamatan pasien.',
    attributes: { care: 88, teamwork: 86, knowledge: 97, resilience: 89 },
  }),
  defineCharacter({
    id: 'doctor-f',
    name: 'Dr. Maya',
    title: 'DOCTOR',
    profession: 'Dokter Wanita',
    color: '#818cf8',
    accessory: 'stethoscope',
    description:
      'Menggabungkan pengetahuan klinis dengan empati. Setiap detail adalah petunjuk untuk memberikan perawatan terbaik.',
    attributes: { care: 91, teamwork: 89, knowledge: 96, resilience: 86 },
  }),
  defineCharacter({
    id: 'nurse-m',
    name: 'Ners Bima',
    title: 'NURSE',
    profession: 'Perawat Pria',
    color: '#10b981',
    accessory: 'badge',
    description:
      'Rekan yang sigap dan dapat diandalkan. Menjaga kenyamanan pasien sekaligus menyatukan semangat tim.',
    attributes: { care: 93, teamwork: 95, knowledge: 78, resilience: 90 },
  }),
  defineCharacter({
    id: 'nurse-f',
    name: 'Ners Alya',
    title: 'NURSE',
    profession: 'Perawat Wanita',
    color: '#22d3ee',
    accessory: 'cap',
    description:
      'Selalu hadir di garis depan, memberikan perawatan, dukungan, dan semangat untuk setiap pasien. Andalan hangat dari tim kesehatan.',
    attributes: { care: 92, teamwork: 88, knowledge: 76, resilience: 84 },
  }),
  defineCharacter({
    id: 'midwife',
    name: 'Bidan Sari',
    title: 'MIDWIFE',
    profession: 'Bidan',
    color: '#e879f9',
    accessory: 'hijab',
    description:
      'Mendampingi ibu dan bayi dengan sabar, terampil, dan penuh perhatian. Membawa ketenangan di setiap langkah kehidupan.',
    attributes: { care: 98, teamwork: 90, knowledge: 85, resilience: 88 },
  }),
  defineCharacter({
    id: 'pharmacist',
    name: 'Apt. Dimas',
    title: 'PHARMACIST',
    profession: 'Apoteker',
    color: '#34d399',
    accessory: 'glasses',
    description:
      'Ahli obat yang cermat dan komunikatif. Memastikan terapi tepat serta membantu pasien memahami pengobatannya.',
    attributes: { care: 83, teamwork: 86, knowledge: 98, resilience: 80 },
  }),
  defineCharacter({
    id: 'analyst',
    name: 'Analis Raka',
    title: 'LABORATORY ANALYST',
    profession: 'Analis Laboratorium',
    color: '#a78bfa',
    accessory: 'goggles',
    description:
      'Membaca petunjuk kecil dengan ketelitian besar. Hasil pemeriksaannya membantu tim menemukan jawaban yang tepat.',
    attributes: { care: 80, teamwork: 87, knowledge: 99, resilience: 85 },
  }),
  defineCharacter({
    id: 'ambulance',
    name: 'Medik Juno',
    title: 'AMBULANCE OFFICER',
    profession: 'Petugas Ambulans',
    color: '#fb923c',
    accessory: 'reflective',
    description:
      'Sigap menghadapi keadaan darurat. Menjaga keselamatan perjalanan dan memberi pertolongan awal dengan kepala dingin.',
    attributes: { care: 86, teamwork: 95, knowledge: 81, resilience: 98 },
  }),
  defineCharacter({
    id: 'surgeon',
    name: 'Dr. Farah',
    title: 'SURGEON',
    profession: 'Dokter Bedah',
    color: '#2dd4bf',
    accessory: 'surgical-cap',
    description:
      'Fokus, presisi, dan percaya pada kerja tim. Menyiapkan setiap tindakan dengan disiplin demi keselamatan pasien.',
    attributes: { care: 87, teamwork: 92, knowledge: 98, resilience: 95 },
  }),
  defineCharacter({
    id: 'radiographer',
    name: 'Rad. Danu',
    title: 'RADIOGRAPHER',
    profession: 'Radiografer',
    color: '#60a5fa',
    accessory: 'dosimeter',
    description:
      'Menghasilkan citra yang jelas dengan teknik dan proteksi yang tepat. Membantu tim melihat kondisi pasien dengan lebih baik.',
    attributes: { care: 85, teamwork: 90, knowledge: 94, resilience: 87 },
  }),
];
export const CHARACTER_REGISTRY: Readonly<Record<string, CharacterDefinition>> = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);
export function getCharacterDefinition(id: string): CharacterDefinition {
  return CHARACTER_REGISTRY[id] ?? CHARACTERS[0];
}

export interface GameSettings {
  questionCount: number;
  duration: number;
  shuffle: boolean;
  countdownSeconds: number;
  revealSeconds: number;
  pullSeconds: number;
  resultSeconds: number;
  baseCorrectPower: number;
  pullMultiplier: number;
  winThreshold: number;
  speedBonus: boolean;
  comboBonus: boolean;
  autoClose: boolean;
  suddenDeath: boolean;
  arena: 'hospital' | 'fantasy';
  quality: Quality;
  particles: boolean;
  sound: boolean;
  music: boolean;
  volume: number;
  cameraMotion: boolean;
}
export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 5,
  duration: 20,
  shuffle: false,
  countdownSeconds: 3,
  revealSeconds: 3,
  pullSeconds: 3,
  resultSeconds: 3,
  baseCorrectPower: 10,
  pullMultiplier: 1.5,
  winThreshold: 100,
  speedBonus: false,
  comboBonus: false,
  autoClose: true,
  suddenDeath: false,
  arena: 'hospital',
  quality: 'AUTO',
  particles: true,
  sound: true,
  music: true,
  volume: 0.4,
  cameraMotion: true,
};
export interface Question {
  id: string;
  packageId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  imageUrl?: string | null;
  duration: number;
  points: number;
  active: boolean;
  sortOrder: number;
}
export interface QuestionPackage {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  active?: boolean;
}
export interface TeamCharacterSlot {
  slot: number; // 0, 1, 2
  characterId: string;
  name: string;
}
export function defaultTeamCharacters(
  team: Team,
): [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot] {
  if (team === 'A') {
    return [
      { slot: 0, characterId: 'doctor-m', name: 'Dr. Arga' },
      { slot: 1, characterId: 'nurse-f', name: 'Ners Alya' },
      { slot: 2, characterId: 'midwife', name: 'Bidan Sari' },
    ];
  }
  return [
    { slot: 0, characterId: 'doctor-f', name: 'Dr. Maya' },
    { slot: 1, characterId: 'pharmacist', name: 'Apt. Dimas' },
    { slot: 2, characterId: 'analyst', name: 'Analis Raka' },
  ];
}
export interface TeamController {
  id: string;
  team: Team;
  name: string;
  connected: boolean;
  ready: boolean;
  characters: [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];
  score: number;
  power: number;
  correctCount: number;
  answered: boolean;
  lastAnswer?: number;
  lastCorrect?: boolean;
}
export interface Player {
  id: string;
  name: string;
  team: Team;
  characterId: string;
  connected: boolean;
  ready: boolean;
  correctCount: number;
  power: number;
  score: number;
  answered: boolean;
}
export interface PublicQuestion {
  id: string;
  text: string;
  options: string[];
  imageUrl?: string | null;
  duration: number;
  points: number;
}
export interface RoundResult {
  questionIndex: number;
  teamAPower: number;
  teamBPower: number;
  ropeBefore: number;
  ropeAfter: number;
  correctAnswer: number;
  explanation: string;
}
export interface RoomState {
  id: string;
  code: string;
  title: string;
  packageId: string;
  packageName: string;
  teamAName: string;
  teamBName: string;
  phase: Phase;
  paused: boolean;
  locked: boolean;
  settings: GameSettings;
  teams: {
    A: TeamController;
    B: TeamController;
  };
  players: Player[];
  questionIndex: number;
  questionCount: number;
  question: PublicQuestion | null;
  correctAnswer?: number;
  explanation?: string;
  deadlineAt: number | null;
  serverTime: number;
  ropePosition: number;
  teamAPower: number;
  teamBPower: number;
  winner: Team | 'DRAW' | null;
  rounds: RoundResult[];
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}
export interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
export interface JoinResult {
  token: string;
  team: Team;
  teamId: string;
  playerId?: string;
  state: RoomState;
}
export interface DashboardData {
  totalMatches: number;
  totalPlayers: number;
  totalQuestions: number;
  activeMatches: number;
  completedMatches: number;
  matches: RoomState[];
}

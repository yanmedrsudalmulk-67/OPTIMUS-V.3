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
export interface CharacterDefinition {
  id: string;
  name: string;
  profession: string;
  color: string;
  accessory: string;
  description: string;
}
export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'doctor-m',
    name: 'Dr. Arga',
    profession: 'Dokter',
    color: '#37bba0',
    accessory: 'stethoscope',
    description: 'Tenang, tangguh, dan selalu siap membantu.',
  },
  {
    id: 'doctor-f',
    name: 'Dr. Maya',
    profession: 'Dokter',
    color: '#7e8ae8',
    accessory: 'stethoscope',
    description: 'Ketelitian adalah kekuatan terbaiknya.',
  },
  {
    id: 'nurse-m',
    name: 'Ners Bima',
    profession: 'Perawat',
    color: '#16a582',
    accessory: 'badge',
    description: 'Semangat besar untuk setiap tarikan.',
  },
  {
    id: 'nurse-f',
    name: 'Ners Alya',
    profession: 'Perawat',
    color: '#4b9be1',
    accessory: 'cap',
    description: 'Gerak cepat, hati hangat, tim kuat.',
  },
  {
    id: 'midwife',
    name: 'Bidan Sari',
    profession: 'Bidan',
    color: '#db8da6',
    accessory: 'hijab',
    description: 'Sahabat andalan untuk tim pemenang.',
  },
  {
    id: 'pharmacist',
    name: 'Apt. Dimas',
    profession: 'Apoteker',
    color: '#e3a83f',
    accessory: 'glasses',
    description: 'Meracik strategi untuk kemenangan.',
  },
  {
    id: 'analyst',
    name: 'Analis Raka',
    profession: 'Analis Lab',
    color: '#a28ad4',
    accessory: 'goggles',
    description: 'Selalu menemukan jawaban yang tepat.',
  },
  {
    id: 'ambulance',
    name: 'Medik Juno',
    profession: 'Petugas Ambulans',
    color: '#e77a4c',
    accessory: 'reflective',
    description: 'Siaga di garis depan, kuat di arena.',
  },
];
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
export function defaultTeamCharacters(team: Team): [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot] {
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

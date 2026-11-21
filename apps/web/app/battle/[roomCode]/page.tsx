import QuickBattleView from '../../../components/game/QuickBattleView';

export default async function BattlePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <QuickBattleView code={roomCode} />;
}

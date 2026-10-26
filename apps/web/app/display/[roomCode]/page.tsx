import GameDisplay from '../../../components/game/GameDisplay';
export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <GameDisplay code={roomCode} />;
}

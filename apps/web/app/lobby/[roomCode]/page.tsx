import PlayerGame from '../../../components/game/PlayerGame';
export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <PlayerGame code={roomCode} mode="lobby" />;
}

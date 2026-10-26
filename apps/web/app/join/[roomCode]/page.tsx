import JoinGame from '../../../components/game/JoinGame';
export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <JoinGame code={roomCode} />;
}

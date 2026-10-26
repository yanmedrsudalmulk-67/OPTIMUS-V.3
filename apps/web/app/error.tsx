'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state" style={{ minHeight: '100vh' }}>
      <h1>Ada kendala di arena</h1>
      <p>Muat ulang untuk mencoba kembali. Data pertandingan tetap tersimpan di server.</p>
      <button className="btn btn-primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}

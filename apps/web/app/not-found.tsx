import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-state" style={{ minHeight: '100vh' }}>
      <h1>Halaman tidak ditemukan</h1>
      <p>Kembali ke arena untuk melanjutkan.</p>
      <Link href="/" className="btn btn-primary">
        Kembali ke beranda
      </Link>
    </main>
  );
}

import type { Metadata } from 'next';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Medical Tug of War — Healthcare Heroes Quiz Battle',
  description:
    'Satukan pengetahuan. Kuatkan tim. Arena kuis tarik tambang 3D untuk para pahlawan kesehatan.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

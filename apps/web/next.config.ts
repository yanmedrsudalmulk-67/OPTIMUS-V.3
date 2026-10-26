import type { NextConfig } from 'next';
import 'dotenv/config';
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.WEB_ORIGIN || '')
      .split(',')
      .filter(Boolean)
      .flatMap((origin) => {
        try {
          return [new URL(origin.trim()).hostname];
        } catch {
          return [];
        }
      }),
  ],
  skipTrailingSlashRedirect: true,
  env: { NEXT_PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || '' },
  turbopack: { root: process.cwd() },
  async rewrites() {
    const api = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4001';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
      { source: '/socket.io', destination: `${api}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${api}/socket.io/:path*` },
    ];
  },
};
export default config;

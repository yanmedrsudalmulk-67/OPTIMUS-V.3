'use client';
import { Component, type ReactNode, useEffect, useState } from 'react';

export function ArenaFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="status"
      style={{
        height: '100%',
        minHeight: compact ? 180 : 260,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        color: '#34534f',
        background: 'linear-gradient(155deg,#e1f0e7,#d9e7ef)',
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          background: '#168e72',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        +
      </span>
      <strong>Arena 3D memerlukan WebGL</strong>
      <span style={{ fontSize: 13, maxWidth: 320 }}>
        Gunakan browser dengan akselerasi grafis. Kamu tetap dapat bergabung dan menjawab
        pertanyaan.
      </span>
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; compact?: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ArenaFallback compact={this.props.compact} /> : this.props.children;
  }
}

export default function WebGLBoundary({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setSupported(!!context);
      if (context) context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
  }, []);
  if (supported === null)
    return (
      <div
        style={{
          height: '100%',
          minHeight: compact ? 180 : 260,
          display: 'grid',
          placeItems: 'center',
          color: '#63817a',
          background: '#e3eee5',
          fontSize: 13,
        }}
      >
        Menyiapkan arena…
      </div>
    );
  if (!supported) return <ArenaFallback compact={compact} />;
  return <ErrorBoundary compact={compact}>{children}</ErrorBoundary>;
}

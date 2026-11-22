'use client';
import { Component, type ReactNode, useEffect, useState } from 'react';
import * as THREE from 'three';

function configureThreeConsoleFilter() {
  if (typeof THREE.setConsoleFunction !== 'function') return;
  THREE.setConsoleFunction((type: 'log' | 'warn' | 'error', message: unknown, ...params: unknown[]) => {
    if (type === 'warn') {
      const text = [message, ...params].map((item) => String(item ?? '')).join(' ');
      if (
        text.includes('THREE.Clock: This module has been deprecated') ||
        (text.includes('WebGLProgram: Program Info Log:') && text.includes('warning X4122'))
      ) {
        return;
      }
      console.warn(message, ...params);
      return;
    }
    if (type === 'error') {
      console.error(message, ...params);
      return;
    }
    console.log(message, ...params);
  });
}

configureThreeConsoleFilter();

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
  transparentLoading = false,
}: {
  children: ReactNode;
  compact?: boolean;
  transparentLoading?: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    return (
      typeof window.WebGL2RenderingContext !== 'undefined' ||
      typeof window.WebGLRenderingContext !== 'undefined'
    );
  });
  useEffect(() => {
    if (supported === null && typeof window !== 'undefined') {
      setSupported(
        typeof window.WebGL2RenderingContext !== 'undefined' ||
          typeof window.WebGLRenderingContext !== 'undefined',
      );
    }
  }, [supported]);
  if (supported === null)
    return (
      <div
        style={{
          height: '100%',
          minHeight: compact ? 180 : 260,
          display: 'grid',
          placeItems: 'center',
          color: transparentLoading ? '#f8fafc' : '#63817a',
          background: transparentLoading ? 'transparent' : '#e3eee5',
          fontSize: 13,
        }}
      >
        Menyiapkan arena…
      </div>
    );
  if (!supported) return <ArenaFallback compact={compact} />;
  return <ErrorBoundary compact={compact}>{children}</ErrorBoundary>;
}

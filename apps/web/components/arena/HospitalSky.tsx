'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** A local painted sky: no downloads and no per-frame cost on mobile. */
export default function HospitalSky() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#627e9b');
    gradient.addColorStop(0.38, '#c2a5a2');
    gradient.addColorStop(0.74, '#f1c497');
    gradient.addColorStop(1, '#f6d9ae');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    const glow = ctx.createRadialGradient(930, 245, 8, 930, 245, 340);
    glow.addColorStop(0, '#fff1c5');
    glow.addColorStop(0.22, '#ffe0a36b');
    glow.addColorStop(1, '#ffce8700');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.filter = 'blur(9px)';
    for (let i = 0; i < 24; i++) {
      const x = ((i * 193) % 1150) - 60;
      const y = 22 + ((i * 73) % 180);
      const width = 44 + (i % 5) * 13;
      ctx.fillStyle = '#42577130';
      ctx.beginPath();
      ctx.ellipse(x, y, width, 10 + (i % 3) * 5, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffce9935';
      ctx.beginPath();
      ctx.ellipse(x + 9, y + 8, width * 0.9, 4, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'none';
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive object={texture} attach="background" />;
}

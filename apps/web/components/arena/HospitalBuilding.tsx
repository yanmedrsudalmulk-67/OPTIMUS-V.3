'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Point = [number, number, number];
type Finish = 'glass' | 'windows' | 'stone' | 'orange' | 'lattice';

function Block({
  position,
  size,
  color = '#eee5d3',
  roughness = 0.75,
}: {
  position: Point;
  size: Point;
  color?: string;
  roughness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function makeTexture(kind: Finish, low: boolean) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = low ? 256 : 512;
  canvas.height = low ? 512 : 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width,
    h = canvas.height;
  if (kind === 'glass' || kind === 'windows') {
    const cols = kind === 'windows' ? 8 : 5;
    const rows = kind === 'windows' ? 2 : 10;
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#092e51');
    sky.addColorStop(0.45, '#176692');
    sky.addColorStop(1, '#123b5a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Broad reflected sky shapes give the curtain wall depth without transmission.
    ctx.fillStyle = '#72b0cd';
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 0);
    ctx.lineTo(w * 0.45, 0);
    ctx.lineTo(w * 0.83, h);
    ctx.lineTo(w * 0.62, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#fbd7a1';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(
        w * (0.12 + (i % 3) * 0.32),
        h * (0.07 + i * 0.14),
        w * 0.28,
        h * 0.021,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#a0cee0' : '#021e35';
        ctx.globalAlpha = (x + y) % 3 === 0 ? 0.09 : 0.1;
        ctx.fillRect((x * w) / cols + 2, (y * h) / rows + 2, w / cols - 4, h / rows - 4);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#18303e';
    ctx.lineWidth = low ? 2 : 3;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / cols, 0);
      ctx.lineTo((i * w) / cols, h);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / rows);
      ctx.lineTo(w, (i * h) / rows);
      ctx.stroke();
    }
  } else if (kind === 'orange' || kind === 'stone') {
    ctx.fillStyle = kind === 'orange' ? '#b74d24' : '#e5ddca';
    ctx.fillRect(0, 0, w, h);
    const columns = kind === 'orange' ? 5 : 7,
      rows = kind === 'orange' ? 6 : 8;
    for (let x = 0; x < columns; x++)
      for (let y = 0; y < rows; y++) {
        ctx.fillStyle =
          kind === 'orange'
            ? ['#c45c2d', '#b94e24', '#cd6532', '#b74d28'][(x * 3 + y) % 4]
            : ['#efe8d9', '#e8dfce', '#f2ecdf', '#e9e0cf'][(x + y) % 4];
        ctx.fillRect((x * w) / columns + 1, (y * h) / rows + 1, w / columns - 2, h / rows - 2);
      }
  } else {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#fff2d7';
    ctx.lineWidth = low ? 2.5 : 5;
    const columns = 4,
      rows = 10,
      cellW = w / columns,
      cellH = h / rows;
    for (let x = 0; x < columns; x++)
      for (let y = 0; y < rows; y++) {
        const cx = (x + 0.5) * cellW,
          cy = (y + 0.5) * cellH;
        ctx.strokeRect(x * cellW, y * cellH, cellW, cellH);
        // Repeating four-petal diamonds echo the white ornamental screen.
        for (let a = 0; a < 4; a++) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((a * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(cellW * 0.2, -cellH * 0.19);
          ctx.lineTo(0, -cellH * 0.44);
          ctx.lineTo(-cellW * 0.2, -cellH * 0.19);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = low ? 1 : 4;
  return texture;
}

function Surface({
  position,
  size,
  texture,
  lattice = false,
  rotation = [0, 0, 0],
}: {
  position: Point;
  size: [number, number];
  texture: THREE.Texture | null;
  lattice?: boolean;
  rotation?: Point;
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={texture}
        color={texture ? '#ffffff' : '#295777'}
        roughness={lattice ? 0.8 : 0.42}
        metalness={lattice ? 0.04 : 0.15}
        alphaTest={lattice ? 0.45 : 0}
        side={lattice ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function Lettering({
  text,
  position,
  width,
  height,
  dark = false,
}: {
  text: string;
  position: Point;
  width: number;
  height: number;
  dark?: boolean;
}) {
  const map = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = dark ? '#252c2a' : '#ede4cf';
    ctx.fillRect(0, 0, 1536, 192);
    if (dark) {
      ctx.fillStyle = '#111916';
      for (let y = 10; y < 192; y += 24) ctx.fillRect(0, y, 1536, 10);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 139px Arial, sans-serif';
    ctx.strokeStyle = dark ? '#151918' : '#c9bbaa';
    ctx.lineWidth = 5;
    ctx.strokeText(text, 768, 104, 1460);
    ctx.fillStyle = dark ? '#ff4434' : '#b93225';
    ctx.fillText(text, 768, 104, 1460);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [text, dark]);
  useEffect(() => () => map?.dispose(), [map]);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} color={map ? '#ffffff' : '#bc392c'} toneMapped={false} />
    </mesh>
  );
}

/** An original courtyard-scale reconstruction of the reference's architectural features. */
export default function HospitalBuilding({ low = false }: { low?: boolean }) {
  const finishes = useMemo(
    () => ({
      glass: makeTexture('glass', low),
      windows: makeTexture('windows', low),
      stone: makeTexture('stone', low),
      orange: makeTexture('orange', low),
      lattice: makeTexture('lattice', low),
    }),
    [low],
  );
  useEffect(
    () => () => Object.values(finishes).forEach((texture) => texture?.dispose()),
    [finishes],
  );
  return (
    <group position={[0, 0, -7.1]} name="rsud-al-mulk">
      {/* White ground-floor colonnade and central volume. */}
      <Block position={[0, 0.85, 0]} size={[12.65, 1.7, 2.25]} color="#c9c2af" />
      <Block position={[-0.55, 3.05, 0]} size={[5.95, 2.7, 2.25]} />
      <Surface position={[-0.55, 3.05, 1.131]} size={[5.95, 2.7]} texture={finishes.stone} />
      <Block position={[0, 0.17, 0.2]} size={[12.9, 0.34, 2.7]} color="#b4b1a0" />

      {/* Left blue curtain-wall tower, with white parapet and vertical frames. */}
      <Block
        position={[-4.95, 2.43, -0.02]}
        size={[2.8, 4.86, 2.25]}
        color="#133953"
        roughness={0.3}
      />
      <Surface position={[-4.95, 2.44, 1.116]} size={[2.8, 4.8]} texture={finishes.glass} />
      <Surface
        position={[-6.36, 2.44, -0.02]}
        size={[2.25, 4.8]}
        texture={finishes.glass}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Block position={[-4.95, 4.89, -0.02]} size={[3.03, 0.15, 2.43]} color="#f5eada" />
      <Block position={[-6.39, 2.46, 1.13]} size={[0.13, 4.83, 0.15]} color="#e9ddc7" />
      <Block position={[-3.51, 2.43, 1.12]} size={[0.16, 4.86, 0.23]} color="#f5ebd9" />

      {/* Orange panel-clad wing with a perforated white screen at its outer edge. */}
      <Block position={[4.35, 3.29, -0.02]} size={[4.0, 3.22, 2.25]} color="#b94e26" />
      <Surface position={[4.35, 3.29, 1.116]} size={[4.0, 3.22]} texture={finishes.orange} />
      <Block position={[4.35, 4.91, -0.02]} size={[4.13, 0.15, 2.38]} color="#b84b24" />
      <Block position={[5.42, 3.25, 1.14]} size={[1.48, 2.58, 0.06]} color="#6e4a32" />
      <Surface
        position={[5.42, 3.25, 1.19]}
        size={[1.45, 2.55]}
        texture={finishes.lattice}
        lattice
      />
      {[4.65, 6.19].map((x) => (
        <Block key={x} position={[x, 3.25, 1.2]} size={[0.07, 2.68, 0.12]} color="#f4e6cc" />
      ))}
      <Block position={[4.35, 1.69, 1.22]} size={[4.13, 0.21, 0.23]} color="#d57139" />

      {/* Deep white roof line and open pergola fins, as in the reference. */}
      <Block position={[-0.53, 4.47, -0.04]} size={[6.0, 0.2, 2.42]} color="#f6ecdb" />
      {[-2.72, -1.7, -0.68, 0.34, 1.36].map((x) => (
        <Block key={x} position={[x, 4.28, 1.35]} size={[0.18, 0.36, 0.78]} color="#e8dec9" />
      ))}
      <Block position={[-0.53, 4.49, 1.65]} size={[6.02, 0.17, 0.21]} color="#f6ecdb" />
      <Block position={[-0.53, 3.94, 1.2]} size={[5.91, 0.66, 0.15]} color="#232d28" />
      <Lettering
        text="RSUD AL-MULK"
        position={[-0.53, 3.95, 1.29]}
        width={5.76}
        height={0.6}
        dark
      />

      {/* Continuous upper clinic windows with pale mullions. */}
      <Block
        position={[-0.55, 2.78, 1.15]}
        size={[5.62, 1.12, 0.11]}
        color="#284958"
        roughness={0.3}
      />
      <Surface position={[-0.55, 2.78, 1.214]} size={[5.57, 1.07]} texture={finishes.windows} />
      {Array.from({ length: 9 }, (_, i) => -3.34 + i * 0.6975).map((x) => (
        <Block key={x} position={[x, 2.78, 1.24]} size={[0.075, 1.2, 0.09]} color="#f0e6d2" />
      ))}
      {[2.22, 2.76, 3.34].map((y) => (
        <Block key={y} position={[-0.55, y, 1.24]} size={[5.7, 0.065, 0.1]} color="#e8deca" />
      ))}

      {/* Ground floor entrance, emergency signage, and projecting glazed canopy. */}
      {[-3.25, 2.35, 4.25, 6.18].map((x) => (
        <Block key={x} position={[x, 0.94, 1.28]} size={[0.19, 1.52, 0.35]} color="#eee4d1" />
      ))}
      <Block position={[0.55, 0.98, 1.18]} size={[1.86, 1.48, 0.12]} color="#273d40" />
      <Surface position={[0.55, 0.98, 1.25]} size={[1.76, 1.4]} texture={finishes.glass} />
      <Block position={[0.55, 0.98, 1.28]} size={[0.055, 1.43, 0.05]} color="#cabd9e" />
      <Block position={[0.55, 1.47, 1.28]} size={[1.8, 0.04, 0.05]} color="#cabd9e" />
      <Lettering text="IGD 24 JAM" position={[-2.05, 1.91, 1.31]} width={2.5} height={0.39} />
      <Lettering text="IGD" position={[0.55, 1.88, 1.31]} width={1.35} height={0.34} />
      <Block
        position={[0.45, 2.19, 1.79]}
        size={[3.3, 0.07, 1.27]}
        color="#45757b"
        roughness={0.28}
      />
      <Block position={[0.45, 2.13, 2.42]} size={[3.45, 0.1, 0.08]} color="#b59b64" />
      {[-0.9, -0.23, 0.44, 1.11, 1.78].map((x) => (
        <Block key={x} position={[x, 2.14, 1.8]} size={[0.045, 0.11, 1.3]} color="#99835c" />
      ))}
      <Block position={[0.45, 0.09, 1.8]} size={[3.8, 0.18, 1.4]} color="#b7ab8d" />
      <Block position={[0.45, 0.19, 1.5]} size={[3.4, 0.16, 0.75]} color="#d4c7a8" />
    </group>
  );
}

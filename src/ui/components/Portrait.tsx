import { useEffect, useRef } from 'react';
import type { PortraitPalette } from '../../types/game';

/** Original 24x24 pixel portrait generated from a palette. */
export function Portrait({ p, size = 64, live = false }: { p: PortraitPalette; size?: number; live?: boolean }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const r = (x: number, y: number, w: number, h: number, col: string): void => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    ctx.clearRect(0, 0, 24, 24);
    r(0, 0, 24, 24, '#1a1236');
    for (let i = 0; i < 24; i += 4) r(i, 0, 2, 24, '#1f1640');
    // shoulders
    r(3, 19, 18, 5, '#140f22');
    r(4, 20, 16, 4, p.shirt);
    r(10, 20, 4, 2, p.accent);
    // neck + head
    r(10, 16, 4, 4, p.skin);
    r(6, 5, 12, 13, '#140f22');
    r(7, 6, 10, 11, p.skin);
    r(7, 15, 10, 2, shade(p.skin));
    // eyes + mouth
    r(9, 10, 2, 2, '#140f22');
    r(13, 10, 2, 2, '#140f22');
    r(9, 10, 1, 1, '#ffffff');
    r(13, 10, 1, 1, '#ffffff');
    r(11, 14, 2, 1, shade(p.skin));
    // hair styles
    const h = p.hair;
    switch (p.hairStyle) {
      case 'short':
        r(6, 4, 12, 4, h);
        r(6, 4, 2, 6, h);
        r(16, 4, 2, 5, h);
        break;
      case 'long':
        r(6, 4, 12, 4, h);
        r(5, 5, 3, 14, h);
        r(16, 5, 3, 14, h);
        break;
      case 'spiky':
        r(6, 4, 12, 4, h);
        for (let x = 6; x < 18; x += 3) r(x, 2, 2, 3, h);
        r(6, 6, 2, 3, h);
        break;
      case 'cap':
        r(5, 3, 14, 5, h);
        r(5, 7, 17, 2, shade(h));
        r(11, 4, 2, 2, '#ffffff');
        break;
      case 'bun':
        r(6, 4, 12, 4, h);
        r(9, 0, 6, 5, h);
        r(6, 6, 2, 4, h);
        r(16, 6, 2, 4, h);
        break;
    }
    if (p.glasses) {
      r(8, 9, 4, 4, '#140f22');
      r(12, 9, 4, 4, '#140f22');
      r(9, 10, 2, 2, '#9fd8ff');
      r(13, 10, 2, 2, '#9fd8ff');
    }
    if (p.headset) {
      r(5, 7, 2, 7, '#2a2a3a');
      r(17, 7, 2, 7, '#2a2a3a');
      r(6, 3, 12, 2, '#2a2a3a');
      r(17, 13, 3, 1, p.accent);
    }
  }, [p]);

  return (
    <span className={`portrait${live ? ' is-live' : ''}`} style={{ width: size, height: size }}>
      <canvas ref={ref} width={24} height={24} style={{ width: size, height: size }} aria-hidden />
    </span>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number): number => Math.max(0, Math.round(v * 0.75));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

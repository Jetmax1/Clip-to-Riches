// Minimal pixel painter on top of Phaser canvas textures. All art in this game is
// original and generated at runtime from code, so there are no third-party assets.

import Phaser from 'phaser';

export interface Painter {
  /** Filled rectangle in integer pixels. */
  r(x: number, y: number, w: number, h: number, color: string): void;
  /** Single pixel. */
  p(x: number, y: number, color: string): void;
  /** 1px outlined rectangle with fill. */
  box(x: number, y: number, w: number, h: number, fill: string, outline: string): void;
  ctx: CanvasRenderingContext2D;
}

export function makePainter(ctx: CanvasRenderingContext2D, ox = 0, oy = 0): Painter {
  const r = (x: number, y: number, w: number, h: number, color: string): void => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + ox), Math.round(y + oy), Math.round(w), Math.round(h));
  };
  return {
    r,
    p: (x, y, c) => r(x, y, 1, 1, c),
    box: (x, y, w, h, fill, outline) => {
      r(x, y, w, h, outline);
      r(x + 1, y + 1, w - 2, h - 2, fill);
    },
    ctx,
  };
}

export function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Painter) => void,
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(makePainter(ctx));
  tex.refresh();
  return tex;
}

/** Build a horizontal strip spritesheet: each frame drawn with its own painter offset. */
export function stripTexture(
  scene: Phaser.Scene,
  key: string,
  fw: number,
  fh: number,
  frames: ((g: Painter) => void)[],
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, fw * frames.length, fh);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  frames.forEach((draw, i) => {
    draw(makePainter(ctx, i * fw, 0));
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
}

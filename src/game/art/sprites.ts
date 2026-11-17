// Procedural pixel-art for the bedroom office. Coordinates are in native game pixels
// (scene is 384x216). Each object is its own transparent texture so it can be
// highlighted, layered and later replaced with hand-drawn art using the same keys.

import Phaser from 'phaser';
import { canvasTexture, stripTexture, type Painter } from './painter';
import { PAL } from './palette';

export const W = 384;
export const H = 216;
export const FLOOR_Y = 146;

export const TEX = {
  room: 'room-bg',
  city: 'city',
  bed: 'bed',
  desk: 'desk',
  chair: 'chair',
  fridge: 'fridge',
  board: 'board',
  player: 'player',
  cat: 'cat',
  screen: 'screen',
  laptopScreen: 'laptop-screen',
  pixel: 'px',
  heart: 'heart',
} as const;

export function buildAllTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, TEX.pixel, 1, 1, (g) => g.r(0, 0, 1, 1, '#ffffff'));
  canvasTexture(scene, TEX.heart, 5, 4, (g) => {
    g.r(0, 0, 2, 2, PAL.pink);
    g.r(3, 0, 2, 2, PAL.pink);
    g.r(0, 1, 5, 1, PAL.pink);
    g.r(1, 2, 3, 1, PAL.pink);
    g.p(2, 3, PAL.pink);
  });
  canvasTexture(scene, TEX.room, W, H, drawRoom);
  canvasTexture(scene, TEX.city, 64, 56, drawCity);
  canvasTexture(scene, TEX.bed, 108, 40, drawBed);
  canvasTexture(scene, TEX.desk, 118, 60, drawDesk);
  canvasTexture(scene, TEX.chair, 30, 40, drawChair);
  canvasTexture(scene, TEX.fridge, 28, 34, drawFridge);
  canvasTexture(scene, TEX.board, 44, 36, drawBoard);
  stripTexture(scene, TEX.screen, 38, 22, [0, 1, 2, 3].map((i) => (g: Painter) => drawScreen(g, i)));
  stripTexture(scene, TEX.laptopScreen, 18, 10, [0, 1].map((i) => (g: Painter) => drawLaptopScreen(g, i)));
  stripTexture(scene, TEX.player, 24, 40, PLAYER_FRAMES);
  stripTexture(scene, TEX.cat, 18, 10, [0, 1, 2].map((i) => (g: Painter) => drawCat(g, i)));
}

// ---------------------------------------------------------------- room

function drawRoom(g: Painter): void {
  // Wall
  g.r(0, 0, W, FLOOR_Y, PAL.wall);
  for (let x = 0; x < W; x += 12) {
    g.r(x, 10, 1, FLOOR_Y - 14, PAL.wallStripe);
    for (let y = 18 + ((x / 12) % 2) * 9; y < FLOOR_Y - 8; y += 18) g.p(x + 6, y, PAL.wallLight);
  }
  g.r(0, 0, W, 8, PAL.wallDark); // ceiling shadow
  // LED strip
  for (let x = 0; x < W; x += 2) {
    const t = x / W;
    g.p(x, 8, t < 0.5 ? PAL.purpleLight : PAL.cyanLight);
    g.p(x + 1, 8, t < 0.5 ? PAL.purple : PAL.cyan);
  }
  g.r(0, 9, W, 1, '#3d2e6a');
  // Baseboard
  g.r(0, FLOOR_Y - 4, W, 4, PAL.baseboard);
  g.r(0, FLOOR_Y - 4, W, 1, PAL.wallLight);

  // Floor planks
  g.r(0, FLOOR_Y, W, H - FLOOR_Y, PAL.floor);
  let row = 0;
  for (let y = FLOOR_Y; y < H; y += 7, row++) {
    g.r(0, y, W, 1, PAL.floorLine);
    g.r(0, y + 1, W, 1, PAL.floorLight);
    const off = (row % 3) * 23;
    for (let x = off; x < W; x += 64) g.r(x, y, 1, 7, PAL.floorLine);
  }
  // Rug
  const rx = 128, ry = 170, rw = 132, rh = 30;
  g.r(rx + 4, ry, rw - 8, rh, PAL.purpleDark);
  g.r(rx, ry + 3, rw, rh - 6, PAL.purpleDark);
  g.r(rx + 6, ry + 3, rw - 12, rh - 6, '#5a3cc0');
  g.r(rx + 10, ry + 7, rw - 20, rh - 14, PAL.purpleDark);
  for (let x = rx + 14; x < rx + rw - 14; x += 8) g.r(x, ry + 14, 4, 2, PAL.cyanDark);
  for (let x = rx + 6; x < rx + rw - 6; x += 3) {
    g.p(x, ry - 1, PAL.cream);
    g.p(x, ry + rh, PAL.cream);
  }

  // Window frame (pane left transparent so the sky layer shows through)
  const wx = 38, wy = 24, ww = 68, wh = 60;
  g.box(wx - 3, wy - 3, ww + 6, wh + 6, PAL.woodLight, PAL.outline);
  g.ctx.clearRect(wx, wy, ww, wh);
  g.r(wx + ww / 2 - 1, wy, 2, wh, PAL.woodLight);
  g.r(wx, wy + wh / 2 - 1, ww, 2, PAL.woodLight);
  g.r(wx - 6, wy + wh + 3, ww + 12, 4, PAL.wood); // sill
  g.r(wx - 6, wy + wh + 7, ww + 12, 1, PAL.outline);
  // Curtains
  for (const cx of [wx - 12, wx + ww + 4]) {
    g.r(cx, wy - 8, 9, wh + 14, PAL.purpleDark);
    for (let y = wy - 8; y < wy + wh + 6; y += 2) g.p(cx + 3, y, PAL.purple);
    g.r(cx + 7, wy - 8, 1, wh + 14, '#3a2780');
  }
  g.r(wx - 14, wy - 10, ww + 28, 2, PAL.metalLight); // rod
  // Plant on sill
  g.r(wx + 52, wy + wh - 6, 8, 9, PAL.orange);
  g.r(wx + 52, wy + wh - 6, 8, 1, '#c25f22');
  for (const [lx, ly] of [[50, -14], [54, -18], [58, -13], [52, -10], [60, -9], [56, -12]] as const) {
    g.r(wx + lx, wy + wh + ly, 3, 5, PAL.green);
    g.p(wx + lx, wy + wh + ly, '#8ff0b0');
  }

  // Poster: neon play button
  g.box(184, 32, 24, 34, '#1a1236', PAL.outline);
  g.r(186, 34, 20, 30, '#22184a');
  for (let i = 0; i < 9; i++) g.r(191 + i, 41 + i / 2, 1, 16 - i, PAL.pink);
  g.r(186, 58, 20, 2, PAL.cyan);
  g.r(188, 61, 10, 1, PAL.cream);
  // Small poster: pixel heart
  g.box(186, 72, 18, 16, '#2d1d4d', PAL.outline);
  g.r(190, 76, 3, 3, PAL.cyan);
  g.r(195, 76, 3, 3, PAL.cyan);
  g.r(190, 78, 8, 2, PAL.cyan);
  g.r(192, 80, 4, 2, PAL.cyan);

  // Shelf with books + speaker + trophy
  g.r(214, 66, 52, 3, PAL.wood);
  g.r(214, 69, 52, 1, PAL.outline);
  g.r(218, 69, 2, 4, PAL.woodDark);
  g.r(260, 69, 2, 4, PAL.woodDark);
  const books: [number, number, string][] = [
    [216, 14, PAL.purple], [219, 12, PAL.cyanDark], [222, 15, PAL.pink], [226, 11, PAL.yellow], [229, 13, PAL.blue],
  ];
  for (const [bx, bh, c] of books) {
    g.r(bx, 66 - bh, 3, bh, c);
    g.p(bx + 1, 66 - bh + 2, PAL.white);
  }
  g.r(233, 60, 10, 6, PAL.metalDark); // leaning book stack
  g.r(233, 58, 12, 2, PAL.orange);
  g.box(248, 52, 12, 14, PAL.metal, PAL.outline); // speaker
  g.r(251, 55, 6, 6, PAL.metalDark);
  g.r(253, 57, 2, 2, PAL.cyan);

  // Wall outlet + cables to desk
  g.box(290, 128, 6, 8, PAL.cream, PAL.outline);
  g.p(292, 131, PAL.outline);
  g.p(293, 131, PAL.outline);
  for (let x = 293; x < 300; x++) g.p(x, 136 + Math.round(Math.sin(x) * 0.5), PAL.outline);
  g.r(299, 136, 1, 8, PAL.outline);
  g.r(270, 141, 1, 5, '#0a0814');
  for (let x = 240; x < 270; x++) g.p(x, FLOOR_Y + 2 + Math.round(Math.sin(x / 4)), '#0a0814');

  // Wall clock area / calendar
  g.box(272, 30, 20, 22, PAL.white, PAL.outline);
  g.r(273, 31, 18, 5, PAL.pink);
  for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 4; xx++) g.r(275 + xx * 4, 39 + yy * 4, 2, 2, yy === 1 && xx === 2 ? PAL.pink : PAL.metalLight);

  // String lights over the bed
  for (let x = 8; x < 30; x += 1) g.p(x, 18 + Math.round(Math.sin(x / 3)), '#3a2c55');
}

function drawCity(g: Painter): void {
  // Transparent background; sky is drawn by the scene. Silhouettes + lit windows.
  const buildings: [number, number, number][] = [
    [0, 30, 10], [9, 22, 12], [20, 34, 8], [27, 16, 13], [39, 26, 9], [47, 20, 10], [56, 30, 8],
  ];
  for (const [x, top, w] of buildings) {
    g.r(x, top, w, 56 - top, '#1a1430');
    g.r(x, top, w, 1, '#2a2148');
    for (let wy = top + 3; wy < 54; wy += 4)
      for (let wx = x + 2; wx < x + w - 1; wx += 3) {
        const lit = (wx * 7 + wy * 13) % 5 < 2;
        g.p(wx, wy, lit ? ((wx + wy) % 3 === 0 ? PAL.cyanLight : PAL.yellow) : '#241c3e');
      }
  }
  g.r(29, 10, 1, 6, '#1a1430'); // antenna
  g.p(29, 9, PAL.pink);
}

function drawBed(g: Painter): void {
  // 108x40, bottom of texture = floor contact.
  g.r(0, 0, 8, 36, PAL.outline); // headboard
  g.r(1, 1, 6, 35, PAL.woodDark);
  g.r(2, 2, 4, 2, PAL.woodLight);
  g.r(100, 12, 6, 24, PAL.outline); // footboard
  g.r(101, 13, 4, 23, PAL.woodDark);
  g.r(6, 26, 96, 8, PAL.outline); // frame
  g.r(7, 27, 94, 6, PAL.wood);
  g.r(7, 27, 94, 1, PAL.woodLight);
  g.r(8, 34, 3, 6, PAL.outline); // legs
  g.r(96, 34, 3, 6, PAL.outline);
  g.r(7, 17, 94, 10, PAL.white); // mattress
  g.r(7, 25, 94, 2, PAL.cream);
  g.r(9, 12, 22, 8, PAL.outline); // pillow
  g.r(10, 13, 20, 6, PAL.cream);
  g.r(11, 13, 18, 2, PAL.white);
  // blanket with pattern
  g.r(30, 14, 71, 13, PAL.outline);
  g.r(31, 15, 69, 11, PAL.purple);
  g.r(31, 15, 69, 2, PAL.purpleLight);
  for (let x = 34; x < 98; x += 8) {
    g.r(x, 19, 3, 3, PAL.purpleDark);
    g.p(x + 4, 23, PAL.cyan);
  }
  g.r(31, 24, 69, 2, PAL.purpleDark);
  // hanging blanket fold
  g.r(60, 26, 30, 6, PAL.purpleDark);
  g.r(60, 31, 30, 1, PAL.outline);
}

function drawDesk(g: Painter): void {
  // 118x60. Desk top at y=30. Monitor above. Bottom = floor contact.
  // Monitor
  g.box(36, 0, 44, 28, PAL.metalDark, PAL.outline);
  g.r(38, 2, 40, 23, '#0b0a18');
  g.r(55, 28, 6, 3, PAL.metal); // stand
  g.r(50, 30, 16, 1, PAL.metalDark);
  // Laptop (open)
  g.r(10, 18, 22, 12, PAL.outline);
  g.r(11, 19, 20, 10, PAL.metal);
  g.r(8, 29, 26, 2, PAL.metalLight);
  // Lamp
  g.r(96, 8, 10, 5, PAL.purple);
  g.r(96, 12, 10, 1, PAL.purpleDark);
  g.r(100, 13, 2, 17, PAL.metalLight);
  g.r(97, 29, 8, 2, PAL.metal);
  // Mug + pencils
  g.r(86, 24, 6, 7, PAL.cyan);
  g.r(92, 26, 2, 3, PAL.cyan);
  g.r(87, 25, 4, 1, '#2b1a14');
  // Keyboard + mouse
  g.r(42, 30, 26, 2, PAL.metalLight);
  g.r(72, 30, 4, 2, PAL.metalLight);
  // Desk top
  g.r(0, 31, 118, 5, PAL.outline);
  g.r(1, 32, 116, 3, PAL.wood);
  g.r(1, 32, 116, 1, PAL.woodLight);
  // Legs + drawers
  g.r(3, 36, 4, 24, PAL.woodDark);
  g.r(3, 36, 1, 24, PAL.outline);
  g.r(88, 36, 28, 24, PAL.outline);
  g.r(89, 37, 26, 22, PAL.wood);
  g.r(89, 47, 26, 1, PAL.outline);
  g.r(100, 41, 4, 1, PAL.metalLight);
  g.r(100, 52, 4, 1, PAL.metalLight);
  // PC tower under desk
  g.r(12, 40, 14, 20, PAL.outline);
  g.r(13, 41, 12, 19, PAL.metalDark);
  g.r(14, 43, 1, 14, PAL.cyan);
  g.r(18, 44, 4, 4, '#1a1a2e');
  g.p(20, 46, PAL.purpleLight);
}

function drawChair(g: Painter): void {
  // 30x40 gaming chair seen from behind (short back so the seated player stays visible).
  g.r(5, 8, 20, 18, PAL.outline);
  g.r(6, 9, 18, 16, '#1e1830');
  g.r(8, 11, 14, 12, PAL.purpleDark);
  g.r(10, 12, 10, 2, PAL.purple);
  g.r(14, 15, 2, 7, PAL.cyan);
  g.r(2, 22, 26, 5, PAL.outline); // seat edge
  g.r(3, 23, 24, 3, '#2a2240');
  g.r(14, 27, 3, 6, PAL.metal); // post
  g.r(5, 33, 20, 2, PAL.metalDark);
  g.r(4, 35, 3, 3, PAL.outline);
  g.r(23, 35, 3, 3, PAL.outline);
  g.r(13, 35, 4, 3, PAL.outline);
}

function drawFridge(g: Painter): void {
  // 28x34 mini fridge with drinks sticker
  g.r(0, 0, 28, 34, PAL.outline);
  g.r(1, 1, 26, 31, '#dfe3f0');
  g.r(1, 1, 26, 2, '#ffffff');
  g.r(1, 11, 26, 1, '#a6abc4');
  g.r(22, 4, 2, 5, PAL.metal);
  g.r(22, 14, 2, 10, PAL.metal);
  g.r(5, 15, 10, 10, PAL.cyanDark); // energy drink sticker
  g.r(7, 16, 6, 8, PAL.cyan);
  g.r(9, 18, 2, 3, PAL.yellow);
  g.r(2, 32, 4, 2, PAL.outline);
  g.r(22, 32, 4, 2, PAL.outline);
}

function drawBoard(g: Painter): void {
  // 44x36 corkboard "trend board"
  g.r(0, 0, 44, 36, PAL.outline);
  g.r(1, 1, 42, 34, PAL.woodLight);
  g.r(3, 3, 38, 30, '#b07a4f');
  for (let i = 0; i < 40; i++) g.p(4 + ((i * 17) % 36), 4 + ((i * 11) % 28), '#9a6842');
  // notes
  g.r(5, 5, 11, 10, PAL.yellow);
  g.r(6, 8, 8, 1, '#a08030');
  g.r(6, 10, 6, 1, '#a08030');
  g.r(19, 6, 12, 12, PAL.white);
  // mini chart
  g.r(21, 15, 2, 2, PAL.cyanDark);
  g.r(24, 12, 2, 5, PAL.cyanDark);
  g.r(27, 9, 2, 8, PAL.pink);
  g.r(33, 5, 8, 9, PAL.cyanLight);
  g.r(34, 8, 6, 1, PAL.cyanDark);
  g.r(6, 19, 12, 11, PAL.pink);
  g.r(8, 22, 8, 1, '#a03060');
  g.r(8, 25, 5, 1, '#a03060');
  g.r(22, 21, 17, 9, PAL.purpleLight);
  g.r(24, 24, 12, 1, PAL.purpleDark);
  // pins
  for (const [x, y] of [[10, 5], [25, 6], [37, 5], [12, 19], [30, 21]] as const) g.p(x, y, '#e0303a');
  // red string
  for (let x = 12; x < 30; x++) g.p(x, 19 - Math.round((x - 12) / 6), '#e0303a');
}

function drawScreen(g: Painter, frame: number): void {
  // 38x22 monitor content: a stream feed with chat and a "LIVE" dot.
  g.r(0, 0, 38, 22, '#140f2c');
  g.r(1, 1, 24, 14, frame % 2 ? '#2a3f8a' : '#2a3a7a');
  // game scene
  g.r(1, 11, 24, 4, '#1f6b4a');
  g.r(4 + frame * 3, 8, 3, 3, PAL.yellow);
  g.r(16, 6, 4, 5, PAL.pink);
  g.r(2, 2, 3, 2, frame < 2 ? '#ff3355' : '#a01d33');
  // facecam
  g.r(19, 1, 6, 5, '#3a2a5a');
  g.r(21, 2, 2, 2, PAL.skin);
  // chat column
  for (let i = 0; i < 6; i++) {
    const y = 2 + ((i * 3 + frame * 2) % 18);
    const c = [PAL.cyan, PAL.pink, PAL.yellow, PAL.purpleLight][(i + frame) % 4]!;
    g.r(27, y, 2, 1, c);
    g.r(30, y, 3 + ((i * 5) % 5), 1, '#8f88b8');
  }
  // timeline
  g.r(1, 17, 24, 2, '#2c2850');
  g.r(1, 17, 6 + frame * 5, 2, PAL.cyan);
  g.r(1, 20, 36, 1, '#2c2850');
}

function drawLaptopScreen(g: Painter, frame: number): void {
  g.r(0, 0, 18, 10, '#101626');
  for (let i = 0; i < 4; i++) g.r(2, 2 + i * 2, 4 + ((i * 7 + frame * 3) % 10), 1, i % 2 ? PAL.cyanDark : PAL.purpleLight);
}

// ---------------------------------------------------------------- cat

function drawCat(g: Painter, frame: number): void {
  // 18x10 sleeping cat, frames: breathe in, breathe out, tail flick
  const body = '#2b2b3d';
  const light = '#45455e';
  const lift = frame === 1 ? 1 : 0;
  g.r(3, 4 + lift, 11, 6 - lift, body);
  g.r(4, 3 + lift, 9, 1, body);
  g.r(5, 4 + lift, 6, 1, light);
  g.r(12, 3, 5, 5, body); // head
  g.p(12, 2, body);
  g.p(16, 2, body);
  g.p(13, 5, '#7ee0c8'); // closed eye line
  g.p(15, 5, '#7ee0c8');
  g.p(14, 6, PAL.pink);
  // tail
  if (frame === 2) {
    g.r(0, 3, 2, 1, body);
    g.r(1, 4, 2, 1, body);
  } else {
    g.r(0, 8, 4, 2, body);
  }
}

// ---------------------------------------------------------------- player

type FrameFn = (g: Painter) => void;

function head(g: Painter, x: number, y: number, facing: 'front' | 'right' | 'back', mouth: 'smile' | 'open' = 'smile'): void {
  // 10x12 head at (x,y)
  g.r(x, y + 1, 10, 11, PAL.outline);
  g.r(x + 1, y, 8, 1, PAL.outline);
  g.r(x + 1, y + 2, 8, 9, PAL.skin);
  g.r(x + 1, y + 10, 8, 1, PAL.skinShadow);
  if (facing === 'back') {
    g.r(x + 1, y + 1, 8, 10, PAL.hair);
    g.r(x + 2, y + 2, 3, 2, PAL.hairLight);
    g.p(x, y + 6, PAL.skin);
    g.p(x + 9, y + 6, PAL.skin);
    return;
  }
  // hair
  g.r(x + 1, y + 1, 8, 3, PAL.hair);
  g.r(x + 2, y + 1, 4, 1, PAL.hairLight);
  if (facing === 'front') {
    g.r(x + 1, y + 4, 1, 3, PAL.hair);
    g.r(x + 8, y + 4, 1, 3, PAL.hair);
    g.r(x + 3, y + 4, 2, 1, PAL.hair); // fringe
    g.r(x + 2, y + 6, 2, 2, PAL.outline); // eyes
    g.r(x + 6, y + 6, 2, 2, PAL.outline);
    g.p(x + 2, y + 6, PAL.white);
    g.p(x + 6, y + 6, PAL.white);
    if (mouth === 'open') {
      g.r(x + 4, y + 9, 2, 2, PAL.outline);
      g.p(x + 4, y + 10, PAL.pink);
    } else {
      g.r(x + 4, y + 9, 2, 1, PAL.skinShadow);
    }
  } else {
    g.r(x + 1, y + 4, 4, 5, PAL.hair); // back of head hair
    g.r(x + 6, y + 4, 2, 1, PAL.hair);
    g.r(x + 7, y + 6, 1, 2, PAL.outline); // eye
    g.p(x + 9, y + 7, PAL.skin); // nose
    g.p(x + 9, y + 8, PAL.outline);
    g.r(x + 6, y + 9, 2, 1, PAL.skinShadow);
    g.p(x + 4, y + 7, PAL.skinShadow); // ear
  }
}

function frontBody(g: Painter, dy: number, arms: 'down' | 'up'): void {
  const y = 16 + dy;
  // torso
  g.r(5, y, 14, 13 - dy, PAL.outline);
  g.r(6, y + 1, 12, 11 - dy, PAL.hoodie);
  g.r(6, y + 1, 2, 11 - dy, PAL.hoodieDark);
  g.r(16, y + 1, 2, 11 - dy, PAL.hoodieLight);
  g.r(8, y + 1, 8, 1, PAL.cyan); // hood trim
  g.r(10, y + 2, 1, 4, PAL.cyan);
  g.r(13, y + 2, 1, 4, PAL.cyan);
  g.r(8, y + 8 - dy, 8, 3, PAL.hoodieDark); // pocket
  if (arms === 'down') {
    g.r(2, y + 1, 4, 11 - dy, PAL.outline);
    g.r(3, y + 2, 2, 8 - dy, PAL.hoodieDark);
    g.r(3, y + 10 - dy, 2, 2, PAL.skin);
    g.r(18, y + 1, 4, 11 - dy, PAL.outline);
    g.r(19, y + 2, 2, 8 - dy, PAL.hoodie);
    g.r(19, y + 10 - dy, 2, 2, PAL.skin);
  } else {
    g.r(2, 3, 4, y - 1, PAL.outline);
    g.r(3, 5, 2, y - 3, PAL.hoodieDark);
    g.r(3, 3, 2, 2, PAL.skin);
    g.r(18, 3, 4, y - 1, PAL.outline);
    g.r(19, 5, 2, y - 3, PAL.hoodie);
    g.r(19, 3, 2, 2, PAL.skin);
  }
}

function legsFront(g: Painter): void {
  g.r(6, 29, 12, 8, PAL.outline);
  g.r(7, 29, 4, 7, PAL.pants);
  g.r(13, 29, 4, 7, PAL.pants);
  g.r(7, 29, 1, 7, PAL.pantsDark);
  g.r(5, 36, 6, 3, PAL.outline);
  g.r(13, 36, 6, 3, PAL.outline);
  g.r(6, 36, 4, 2, PAL.shoe);
  g.r(14, 36, 4, 2, PAL.shoe);
  g.r(6, 38, 4, 1, PAL.sole);
  g.r(14, 38, 4, 1, PAL.sole);
}

const idle = (dy: number): FrameFn => (g) => {
  head(g, 7, 4 + dy, 'front');
  frontBody(g, dy, 'down');
  legsFront(g);
};

const cheer: FrameFn = (g) => {
  head(g, 7, 4, 'front', 'open');
  frontBody(g, 0, 'up');
  legsFront(g);
};

const walk = (phase: number): FrameFn => (g) => {
  const bob = phase % 2 === 1 ? 1 : 0;
  // legs: back leg darker
  const stride = [0, 3, 0, -3][phase] ?? 0;
  const leg = (x: number, color: string): void => {
    g.r(x - 1, 29, 6, 8, PAL.outline);
    g.r(x, 29, 4, 7, color);
    g.r(x - 1, 36, 7, 3, PAL.outline);
    g.r(x, 36, 6, 2, PAL.shoe);
    g.r(x, 38, 6, 1, PAL.sole);
  };
  leg(10 - stride, PAL.pantsDark);
  leg(10 + stride, PAL.pants);
  // torso (side)
  const y = 16 + bob;
  g.r(7, y, 11, 14 - bob, PAL.outline);
  g.r(8, y + 1, 9, 12 - bob, PAL.hoodie);
  g.r(8, y + 1, 2, 12 - bob, PAL.hoodieDark);
  g.r(6, y + 1, 3, 6, PAL.hoodieDark); // hood bunched on back
  g.r(14, y + 1, 3, 1, PAL.cyan);
  // arm swing
  const ax = 11 - stride;
  g.r(ax, y + 2, 4, 9, PAL.outline);
  g.r(ax + 1, y + 3, 2, 6, PAL.hoodieLight);
  g.r(ax + 1, y + 9, 2, 2, PAL.skin);
  head(g, 7, 4 + bob, 'right');
};

const sit = (tap: number): FrameFn => (g) => {
  // back view, sitting: shoulders + arms reaching to the keyboard
  head(g, 7, 6, 'back');
  const y = 18;
  g.r(4, y, 16, 16, PAL.outline);
  g.r(5, y + 1, 14, 15, PAL.hoodie);
  g.r(7, y + 1, 10, 6, PAL.hoodieDark); // hood on back
  g.r(8, y + 2, 8, 4, PAL.hoodie);
  g.r(5, y + 1, 1, 15, PAL.hoodieDark);
  g.r(18, y + 1, 1, 15, PAL.hoodieLight);
  // arms reaching forward/up
  g.r(1, y + 1 - tap, 4, 8, PAL.outline);
  g.r(2, y + 2 - tap, 2, 6, PAL.hoodieDark);
  g.r(19, y + 1 - (1 - tap), 4, 8, PAL.outline);
  g.r(20, y + 2 - (1 - tap), 2, 6, PAL.hoodie);
  g.r(5, y + 15, 14, 6, PAL.pants);
};

/** Frame indices: 0-1 idle, 2-5 walk, 6-7 sit/typing, 8 cheer. */
export const PLAYER_FRAMES: FrameFn[] = [idle(0), idle(1), walk(0), walk(1), walk(2), walk(3), sit(0), sit(1), cheer];

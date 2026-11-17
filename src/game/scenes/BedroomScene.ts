// The bedroom office. Presentation only: it reads the store for time/state and
// calls store UI actions when the player interacts with objects.

import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { minuteOfDay } from '../../sim/time';
import { useGame } from '../../state/store';
import { buildAllTextures, H, TEX, W } from '../art/sprites';
import { PAL } from '../art/palette';

type TargetId = 'computer' | 'bed' | 'fridge' | 'board' | 'cat';

interface Target {
  id: TargetId;
  label: string;
  standX: number;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  hit: Phaser.Geom.Rectangle;
}

const WALK_Y = 182;
const SIT = { x: 321, y: 160 };
const SPEED = 78; // px per second

export class BedroomScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private sky!: Phaser.GameObjects.Graphics;
  private darkness!: Phaser.GameObjects.Rectangle;
  private glows: { img: Phaser.GameObjects.Image; base: number; speed: number }[] = [];
  private targets: Target[] = [];
  private label!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private screen!: Phaser.GameObjects.Sprite;
  private laptop!: Phaser.GameObjects.Sprite;
  private dust: { o: Phaser.GameObjects.Image; vx: number; vy: number }[] = [];
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'e' | 'space', Phaser.Input.Keyboard.Key>;

  private moveTo: number | null = null;
  private pending: TargetId | null = null;
  private sitting = false;
  private cheering = 0;
  private openTimer: number | null = null;
  private hovered: Target | null = null;
  private lastSkyHour = -1;
  private unsub: (() => void) | null = null;

  constructor() {
    super('Bedroom');
  }

  create(): void {
    buildAllTextures(this);
    this.makeGlowTexture();
    this.createAnims();

    this.sky = this.add.graphics().setDepth(0);
    this.add.image(40, 28, TEX.city).setOrigin(0, 0).setDepth(1);
    this.add.image(0, 0, TEX.room).setOrigin(0, 0).setDepth(2);

    // Furniture
    const bed = this.add.image(6, 166, TEX.bed).setOrigin(0, 1).setDepth(166);
    const board = this.add.image(130, 44, TEX.board).setOrigin(0, 0).setDepth(3);
    const fridge = this.add.image(216, 164, TEX.fridge).setOrigin(0, 1).setDepth(164);
    const desk = this.add.image(262, 164, TEX.desk).setOrigin(0, 1).setDepth(164);
    this.screen = this.add.sprite(301, 106, TEX.screen, 0).setOrigin(0, 0).setDepth(165);
    this.laptop = this.add.sprite(274, 123, TEX.laptopScreen, 0).setOrigin(0, 0).setDepth(165);
    this.add.image(306, 176, 'chair').setOrigin(0, 1).setDepth(176);
    const cat = this.add.sprite(78, 144, TEX.cat, 0).setOrigin(0, 1).setDepth(167);
    cat.play('cat-sleep');

    this.player = this.add.sprite(200, WALK_Y, TEX.player, 0).setOrigin(0.5, 1).setDepth(WALK_Y);
    this.player.play('idle');

    // Lighting
    this.darkness = this.add.rectangle(0, 0, W, H, 0x07041a, 0.3).setOrigin(0, 0).setDepth(500);
    this.addGlow(320, 116, 0x4fd8e8, 1.6, 0.35, 0.004); // monitor
    this.addGlow(283, 128, 0xa587ff, 0.7, 0.25, 0.006); // laptop
    this.addGlow(355, 118, 0xffc27a, 1.1, 0.25, 0.002); // lamp
    this.addGlow(96, 8, 0xa587ff, 2.4, 0.18, 0.003); // LED left
    this.addGlow(290, 8, 0x4fd8e8, 2.4, 0.18, 0.003); // LED right
    this.addGlow(270, 160, 0x4fd8e8, 0.5, 0.2, 0.01); // PC tower
    for (let i = 0; i < 14; i++) {
      const o = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(20, 170), TEX.pixel).setDepth(520).setAlpha(0.35);
      this.dust.push({ o, vx: Phaser.Math.FloatBetween(-2, 2), vy: Phaser.Math.FloatBetween(-3, -1) });
    }

    // Interactables
    this.targets = [
      { id: 'computer', label: 'Computer', standX: SIT.x, sprite: desk, hit: new Phaser.Geom.Rectangle(262, 100, 118, 78) },
      { id: 'bed', label: 'Bed — sleep', standX: 100, sprite: bed, hit: new Phaser.Geom.Rectangle(6, 124, 70, 44) },
      { id: 'cat', label: 'Byte the cat', standX: 86, sprite: cat, hit: new Phaser.Geom.Rectangle(74, 132, 26, 14) },
      { id: 'fridge', label: 'Mini fridge', standX: 230, sprite: fridge, hit: new Phaser.Geom.Rectangle(214, 128, 32, 38) },
      { id: 'board', label: 'Trend board', standX: 152, sprite: board, hit: new Phaser.Geom.Rectangle(128, 42, 48, 40) },
    ];

    this.label = this.add
      .text(0, 0, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff', backgroundColor: '#1a1236', padding: { x: 3, y: 3 } })
      .setDepth(900)
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setResolution(2);
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: PAL.cyanLight, backgroundColor: '#0c0918cc', padding: { x: 3, y: 2 } })
      .setDepth(901)
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setResolution(2);

    this.setupInput();
    this.time.addEvent({ delay: 380, loop: true, callback: () => this.animateScreens() });

    this.unsub = useGame.subscribe((state, prev) => {
      // World presentation must never break game logic running in the same set() call.
      try {
        if (this.sys.isActive()) this.onStore(state, prev);
      } catch (e) {
        console.warn('[world] store sync failed', e);
      }
    });
    const cleanup = (): void => {
      this.unsub?.();
      this.unsub = null;
      if (this.openTimer !== null) window.clearTimeout(this.openTimer);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.updateSky(true);
    this.game.events.emit('world-ready');
  }

  // ------------------------------------------------------------ setup helpers

  private makeGlowTexture(): void {
    if (this.textures.exists('glow')) return;
    const size = 64;
    const tex = this.textures.createCanvas('glow', size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  private addGlow(x: number, y: number, color: number, scale: number, alpha: number, speed: number): void {
    const img = this.add.image(x, y, 'glow').setTint(color).setScale(scale).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(510);
    this.glows.push({ img, base: alpha, speed });
  }

  private createAnims(): void {
    const a = this.anims;
    if (a.exists('idle')) return;
    a.create({ key: 'idle', frames: a.generateFrameNumbers(TEX.player, { frames: [0, 0, 0, 1, 1, 1] }), frameRate: 4, repeat: -1 });
    a.create({ key: 'walk', frames: a.generateFrameNumbers(TEX.player, { frames: [2, 3, 4, 5] }), frameRate: 8, repeat: -1 });
    a.create({ key: 'type', frames: a.generateFrameNumbers(TEX.player, { frames: [6, 7] }), frameRate: 6, repeat: -1 });
    a.create({ key: 'cheer', frames: a.generateFrameNumbers(TEX.player, { frames: [8, 0, 8] }), frameRate: 5, repeat: 2 });
    a.create({ key: 'cat-sleep', frames: a.generateFrameNumbers(TEX.cat, { frames: [0, 0, 1, 1, 0, 0, 1, 1, 2] }), frameRate: 2, repeat: -1 });
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      // enableCapture=false so React text inputs keep working.
      this.keys = {
        left: kb.addKey(K.LEFT, false),
        right: kb.addKey(K.RIGHT, false),
        a: kb.addKey(K.A, false),
        d: kb.addKey(K.D, false),
        e: kb.addKey(K.E, false),
        space: kb.addKey(K.SPACE, false),
      };
      this.keys.e.on('down', () => this.tryInteractNearest());
      this.keys.space.on('down', () => this.tryInteractNearest());
    }

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen()) return this.setHover(null);
      this.setHover(this.targets.find((t) => t.hit.contains(p.worldX, p.worldY)) ?? null);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen()) return;
      const t = this.targets.find((tt) => tt.hit.contains(p.worldX, p.worldY));
      if (t) {
        sfx.play('click');
        this.walkTo(t.standX, t.id);
      } else if (p.worldY > 140) {
        this.walkTo(Phaser.Math.Clamp(p.worldX, 16, W - 16), null);
      }
    });
  }

  // ------------------------------------------------------------ store sync

  private onStore(state: ReturnType<typeof useGame.getState>, prev: ReturnType<typeof useGame.getState>): void {
    const g = state.game;
    const pg = prev.game;
    // Quit to title, new game or a loaded save: reset the world instead of diffing states.
    const replaced = !g || !pg || g.createdAt !== pg.createdAt || g.worldSeed !== pg.worldSeed || g.minute < pg.minute;
    if (replaced) {
      this.resetWorld();
      return;
    }
    const overlayWas = !!prev.ui.panel || !!prev.ui.modal;
    const overlayNow = !!state.ui.panel || !!state.ui.modal;
    // A window opened mid-walk: stop walking so the walk can't fire an action behind it.
    if (!overlayWas && overlayNow && !this.sitting) this.cancelWalk();
    // Stand up when leaving the computer.
    if (prev.ui.panel && !state.ui.panel && this.sitting) this.standUp();
    // Big time jump (sleep) → fade.
    if (g.minute - pg.minute > 120) {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.cameras.main.fadeIn(600));
    }
    // Celebrate exactly one new publish.
    if (g.published.length === pg.published.length + 1) {
      const clip = g.published[g.published.length - 1];
      this.celebrate(!!clip?.factors.viral);
    }
    if (g.minute !== pg.minute) this.updateSky(false);
  }

  private cancelWalk(): void {
    this.moveTo = null;
    this.pending = null;
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (!this.sitting && this.cheering <= 0) this.player.play('idle', true);
  }

  private resetWorld(): void {
    this.cancelWalk();
    this.cheering = 0;
    if (this.sitting) this.standUp();
    else this.player.play('idle', true);
    this.setHover(null);
    this.updateSky(true);
  }

  private overlayOpen(): boolean {
    const ui = useGame.getState().ui;
    return ui.screen !== 'game' || !!ui.panel || !!ui.modal;
  }

  // ------------------------------------------------------------ interaction

  private setHover(t: Target | null): void {
    if (this.hovered === t) return;
    if (this.hovered) {
      this.hovered.sprite.preFX?.clear();
    }
    this.hovered = t;
    this.input.setDefaultCursor(t ? 'pointer' : 'default');
    if (t) {
      t.sprite.preFX?.addGlow(0x4fd8e8, 2, 0, false, 0.1, 6);
      this.label.setText(t.label).setPosition(t.hit.centerX, t.hit.y - 2).setVisible(true);
    } else {
      this.label.setVisible(false);
    }
  }

  private walkTo(x: number, target: TargetId | null): void {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (this.sitting) this.standUp();
    this.moveTo = x;
    this.pending = target;
  }

  private tryInteractNearest(): void {
    if (this.overlayOpen() || this.isTyping()) return;
    // Space/E on a focused UI button belongs to that button, not the world.
    if (document.activeElement instanceof HTMLButtonElement) return;
    const near = this.nearestTarget();
    if (near) this.walkTo(near.standX, near.id);
  }

  private isTyping(): boolean {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  private nearestTarget(): Target | null {
    let best: Target | null = null;
    let dist = 22;
    for (const t of this.targets) {
      const d = Math.abs(t.standX - this.player.x);
      if (d < dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  }

  private arrive(target: TargetId): void {
    if (this.overlayOpen()) return;
    const s = useGame.getState();
    switch (target) {
      case 'computer':
        this.sitDown();
        // Real timer (not Phaser time) so the UI opens even when frames are throttled.
        this.openTimer = window.setTimeout(() => {
          this.openTimer = null;
          if (!this.sitting || this.overlayOpen()) return;
          useGame.getState().openPanel(useGame.getState().ui.activeDraftId ? 'studio' : 'streams');
        }, 220);
        break;
      case 'bed':
        s.openModal('sleep');
        break;
      case 'fridge':
        s.openModal('fridge');
        break;
      case 'board':
        s.openModal('trends');
        break;
      case 'cat':
        this.player.setFlipX(true);
        s.petCat();
        this.hearts(88, 132);
        break;
    }
  }

  private sitDown(): void {
    this.sitting = true;
    this.player.setPosition(SIT.x, SIT.y).setDepth(170).setFlipX(false);
    this.player.play('type');
  }

  private standUp(): void {
    this.sitting = false;
    this.player.setPosition(SIT.x, WALK_Y).setDepth(WALK_Y);
    this.player.play('idle');
  }

  private celebrate(viral: boolean): void {
    if (this.sitting) return this.confetti(viral ? 40 : 14);
    this.cheering = 1600;
    this.player.play('cheer');
    this.confetti(viral ? 40 : 14);
  }

  private confetti(n: number): void {
    const colors = [0xff5fa2, 0x4fd8e8, 0xffd166, 0xa587ff, 0x5fd38a];
    for (let i = 0; i < n; i++) {
      const p = this.add.image(this.player.x, this.player.y - 40, TEX.pixel).setTint(colors[i % colors.length]!).setScale(2).setDepth(950);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-70, 70),
        y: p.y + Phaser.Math.Between(-40, 50),
        alpha: 0,
        duration: Phaser.Math.Between(700, 1400),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private hearts(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const h = this.add.image(x + i * 5 - 5, y, TEX.heart).setDepth(950);
      this.tweens.add({ targets: h, y: y - 18 - i * 4, alpha: 0, delay: i * 150, duration: 900, onComplete: () => h.destroy() });
    }
  }

  // ------------------------------------------------------------ visuals

  private animateScreens(): void {
    const working = !!useGame.getState().ui.panel;
    this.screen.setFrame((Number(this.screen.frame.name) + 1) % 4);
    this.laptop.setFrame(working ? (Number(this.laptop.frame.name) + 1) % 2 : 0);
  }

  private updateSky(force: boolean): void {
    const g = useGame.getState().game;
    const minute = g ? minuteOfDay(g.minute) : 21 * 60;
    const hour = Math.floor(minute / 10); // redraw every 10 game minutes
    if (!force && hour === this.lastSkyHour) return;
    this.lastSkyHour = hour;
    const h = minute / 60;
    const night = h < 5 || h >= 20.5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h >= 18 ? (h - 18) / 2.5 : 0;
    const dusk = h >= 16.5 && h < 20.5 ? 1 - Math.abs(h - 18.5) / 2 : h >= 5 && h < 8 ? 1 - Math.abs(h - 6.5) / 1.5 : 0;

    const top = mix(mix(0x5aa8e0, 0x0b0820, night), 0x5a2c8a, Math.max(0, dusk) * 0.6);
    const bottom = mix(mix(0xbfe6ff, 0x24164a, night), 0xff8a5c, Math.max(0, dusk) * 0.7);
    const sky = this.sky;
    sky.clear();
    const x = 38, y = 24, w = 68, hgt = 60;
    for (let i = 0; i < hgt; i += 2) {
      sky.fillStyle(mix(top, bottom, i / hgt), 1);
      sky.fillRect(x, y + i, w, 2);
    }
    if (night > 0.4) {
      for (let i = 0; i < 18; i++) {
        sky.fillStyle(0xffffff, 0.5 + ((i * 37) % 5) / 10);
        sky.fillRect(x + ((i * 29) % w), y + ((i * 17) % 34), 1, 1);
      }
      sky.fillStyle(0xf4f1ff, 1);
      sky.fillRect(x + 50, y + 8, 6, 6);
      sky.fillStyle(mix(top, bottom, 0.15), 1);
      sky.fillRect(x + 52, y + 8, 4, 4);
    } else {
      const sunY = y + 6 + Math.abs(h - 13) * 4;
      sky.fillStyle(0xffe08a, 1);
      sky.fillRect(x + 12 + (h - 6) * 3, Math.min(y + hgt - 8, sunY), 7, 7);
    }
    this.darkness.setAlpha(0.1 + night * 0.32);
  }

  // ------------------------------------------------------------ loop

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const t = this.time.now;
    for (const gl of this.glows) gl.img.setAlpha(gl.base + Math.sin(t * gl.speed) * gl.base * 0.25);
    for (const d of this.dust) {
      d.o.x += d.vx * dt;
      d.o.y += d.vy * dt;
      if (d.o.y < 12) d.o.setPosition(Phaser.Math.Between(0, W), 175);
    }

    if (this.cheering > 0) {
      this.cheering -= delta;
      if (this.cheering <= 0 && !this.sitting) this.player.play('idle');
      return;
    }

    let dir = 0;
    if (!this.overlayOpen() && !this.isTyping() && this.keys) {
      if (this.keys.left.isDown || this.keys.a.isDown) dir = -1;
      if (this.keys.right.isDown || this.keys.d.isDown) dir = 1;
    }
    if (dir !== 0) {
      if (this.sitting) this.standUp();
      this.moveTo = null;
      this.pending = null;
      this.step(dir, dt);
    } else if (this.moveTo !== null) {
      const dx = this.moveTo - this.player.x;
      if (Math.abs(dx) <= 1.5) {
        this.player.x = this.moveTo;
        this.moveTo = null;
        this.player.play('idle', true);
        const target = this.pending;
        this.pending = null;
        if (target) this.arrive(target);
      } else {
        this.step(Math.sign(dx), dt, Math.abs(dx));
      }
    } else if (!this.sitting && this.player.anims.currentAnim?.key === 'walk') {
      this.player.play('idle');
    }

    // Proximity prompt
    const near = this.sitting || this.overlayOpen() ? null : this.nearestTarget();
    if (near && this.moveTo === null) {
      this.prompt.setText(`[E] ${near.label}`).setPosition(this.player.x, this.player.y - 44).setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
  }

  private step(dir: number, dt: number, max = Infinity): void {
    this.player.x = Phaser.Math.Clamp(this.player.x + dir * Math.min(SPEED * dt, max), 16, W - 16);
    this.player.setFlipX(dir < 0);
    if (this.player.anims.currentAnim?.key !== 'walk') this.player.play('walk');
  }
}

function mix(a: number, b: number, t: number): number {
  const k = Phaser.Math.Clamp(t, 0, 1);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

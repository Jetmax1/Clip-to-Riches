import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { H, W } from './art/sprites';
import { BedroomScene } from './scenes/BedroomScene';

/** Mounts the Phaser world once. React overlays sit on top of it. */
export function PhaserGame(): JSX.Element {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: W,
      height: H,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#0c0918',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [BedroomScene],
      audio: { noAudio: true },
      banner: false,
    });
    (window as unknown as { __phaser?: Phaser.Game }).__phaser = game;
    return () => game.destroy(true);
  }, []);

  return <div ref={host} className="world" aria-label="Bedroom office. Click objects or use arrow keys and E to interact." />;
}

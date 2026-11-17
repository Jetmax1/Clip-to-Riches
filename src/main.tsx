import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useGame } from './state/store';
import './styles/global.css';

async function boot(): Promise<void> {
  // Phaser text needs the pixel font ready before the scene draws labels.
  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* continue with fallback fonts */
  }
  // Dev-only QA hook for inspecting state from the console.
  if (import.meta.env.DEV) (window as unknown as { __game?: typeof useGame }).__game = useGame;
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();

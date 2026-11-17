import { useEffect } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { useGame, type PanelId } from './state/store';
import { ComputerWindow } from './ui/ComputerWindow';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Dock, Hud, Objectives, Toasts } from './ui/Hud';
import { Modals } from './ui/Modals';
import { TitleScreen } from './ui/TitleScreen';

const AUTOSAVE_MS = 60_000;

function useGameLoop(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1000, now - last); // clamp: a stalled timer doesn't fast-forward
      last = now;
      // The game pauses while the tab is in the background.
      if (document.visibilityState === 'hidden') return;
      useGame.getState().tick(dt);
    }, 100);
    const save = window.setInterval(() => void useGame.getState().saveSlot('autosave', true), AUTOSAVE_MS);
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') void useGame.getState().saveSlot('autosave', true);
    };
    // On reload/close, async IndexedDB writes may never finish: write a sync snapshot too.
    const onUnload = (): void => {
      useGame.getState().emergencySave();
      void useGame.getState().saveSlot('autosave', true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(id);
      window.clearInterval(save);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [active]);
}

function useShortcuts(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const panels: Record<string, PanelId> = { '1': 'streams', '2': 'studio', '3': 'publish', '4': 'analytics' };
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      const s = useGame.getState();
      // Open dialogs handle their own keys (including Esc).
      if (s.ui.modal) return;
      if (e.key === 'Escape') {
        if (s.ui.panel) s.openPanel(null);
        else s.openModal('menu');
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const panel = panels[e.key];
      if (panel) s.openPanel(panel);
      if (e.key === 'p' || e.key === 'P') s.togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

export function App(): JSX.Element {
  const screen = useGame((s) => s.ui.screen);
  const hasGame = useGame((s) => !!s.game);
  const inGame = screen === 'game' && hasGame;
  useGameLoop(inGame);
  useShortcuts(inGame);

  return (
    <div className={`app${inGame ? ' in-game' : ' on-title'}`}>
      <PhaserGame />
      <ErrorBoundary scope="app">
        {inGame ? (
          <>
            <Hud />
            <Objectives />
            <ComputerWindow />
            <Dock />
            <Modals />
          </>
        ) : (
          <TitleScreen />
        )}
        <Toasts />
      </ErrorBoundary>
    </div>
  );
}

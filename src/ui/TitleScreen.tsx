import { useEffect, useState } from 'react';
import { saveSystem, type SlotInfo } from '../save/saveSystem';
import { useGame } from '../state/store';
import { compact, money, timeAgo } from './format';
import { ConfirmNewModal, HelpModal, SavesModal } from './Modals';

export function TitleScreen(): JSX.Element {
  const newGame = useGame((s) => s.newGame);
  const loadSlot = useGame((s) => s.loadSlot);
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [dialog, setDialog] = useState<'load' | 'new' | 'help' | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Promote the page-close snapshot (if newer) before reading the slots.
    void saveSystem
      .recoverEmergency()
      .catch(() => false)
      .then(() => saveSystem.listSlots())
      .then((list) => {
        if (!cancelled) setSlots(list);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dialog]);

  const loading = slots === null;
  const auto = slots?.find((s) => s.slot === 'autosave') ?? null;
  const anySave = !!slots?.some((s) => !s.empty);
  const canContinue = !!auto && !auto.empty && !auto.corrupted;

  return (
    <div className="title-screen">
      <div className="title-card">
        <h1 className="logo">
          <span className="logo-a">CLIP</span>
          <span className="logo-b">to</span>
          <span className="logo-c">RICHES</span>
        </h1>
        <p className="subtitle">From a $250 bedroom setup to a media empire.</p>
        <div className="title-buttons" aria-busy={loading}>
          {/* Reserve the Continue slot while loading so buttons don't jump under the cursor. */}
          {loading ? (
            <button className="btn primary big" disabled>
              Checking saves…
            </button>
          ) : (
            canContinue && (
              <button className="btn primary big" onClick={() => void loadSlot('autosave')} autoFocus>
                Continue
                <span className="small">
                  Day {auto.summary?.day} · {money(auto.summary?.cash ?? 0)} · {compact(auto.summary?.followers ?? 0)} followers · {auto.savedAt ? timeAgo(auto.savedAt) : ''}
                </span>
              </button>
            )
          )}
          {auto?.corrupted && <p className="bad small">Your autosave is corrupted ({auto.error}). You can still load a manual slot or start fresh.</p>}
          <button
            className={`btn big${canContinue || loading ? '' : ' primary'}`}
            disabled={loading}
            onClick={() => (anySave ? setDialog('new') : newGame())}
            autoFocus={!loading && !canContinue}
          >
            New game
          </button>
          <button className="btn" disabled={loading} onClick={() => setDialog('load')}>Load game</button>
          <button className="btn ghost" onClick={() => setDialog('help')}>How to play</button>
        </div>
        <p className="muted small">All streamers, platforms and clips in this game are fictional.</p>
      </div>
      {dialog === 'load' && <SavesModal forceMode="load" onClose={() => setDialog(null)} />}
      {dialog === 'new' && <ConfirmNewModal onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpModal onClose={() => setDialog(null)} />}
    </div>
  );
}

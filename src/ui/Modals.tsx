import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import { BALANCE } from '../data/balance';
import { CATEGORY_COLOR, CATEGORY_LABEL, MOMENT_CATEGORIES } from '../data/editorOptions';
import { PLATFORMS, PLATFORM_IDS } from '../data/platforms';
import { saveSystem, SLOT_IDS, type SlotId, type SlotInfo } from '../save/saveSystem';
import { drinkPrice, sleepEnergyGain } from '../sim/engine';
import { generateTrends } from '../sim/streams';
import { formatClock, formatDuration, hourOf, streamDayOf } from '../sim/time';
import { useGame } from '../state/store';
import { compact, money, timeAgo } from './format';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: focuses its first control, traps Tab, closes on Esc and restores focus. */
export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('.modal-body ' + FOCUSABLE) ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="btn tiny close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Modals(): JSX.Element | null {
  const modal = useGame((s) => s.ui.modal);
  switch (modal) {
    case 'menu':
      return <MenuModal />;
    case 'saves':
      return <SavesModal />;
    case 'confirm-new':
      return <ConfirmNewModal />;
    case 'sleep':
      return <SleepModal />;
    case 'fridge':
      return <FridgeModal />;
    case 'trends':
      return <TrendsModal />;
    case 'offline':
      return <OfflineModal />;
    case 'help':
      return <HelpModal />;
    case 'gameover':
      return <GameOverModal />;
    default:
      return null;
  }
}

function useClose(): () => void {
  const openModal = useGame((s) => s.openModal);
  return () => openModal(null);
}

/** Two-step confirm button: first click arms it, second click within 3 s runs it. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn',
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      className={`${className}${armed ? ' armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

function MenuModal(): JSX.Element {
  const close = useClose();
  const openModal = useGame((s) => s.openModal);
  const saveSlot = useGame((s) => s.saveSlot);
  const quit = useGame((s) => s.quitToTitle);
  const lastSaved = useGame((s) => s.ui.lastSavedAt);
  const saveError = useGame((s) => s.ui.saveError);
  const [sound, setSound] = useState(sfx.enabled);
  const [quitFailed, setQuitFailed] = useState(false);
  return (
    <Modal title="Menu · game paused" onClose={close}>
      <div className="menu-list">
        <button className="btn primary" onClick={close}>Resume</button>
        <button className="btn" onClick={() => openModal('saves', 'save')}>Save game…</button>
        <button className="btn" onClick={() => openModal('saves', 'load')}>Load game…</button>
        <button className="btn" onClick={() => void saveSlot('autosave')}>Quick save (autosave slot)</button>
        <button
          className="btn"
          onClick={() => {
            sfx.setEnabled(!sound);
            setSound(!sound);
            sfx.play('click');
          }}
          aria-pressed={sound}
        >
          Sound: {sound ? 'On' : 'Off'}
        </button>
        <button className="btn" onClick={() => openModal('help')}>How to play</button>
        <button className="btn danger" onClick={() => openModal('confirm-new')}>New game…</button>
        {quitFailed ? (
          <ConfirmButton className="btn danger" label="Save failed — quit without saving?" confirmLabel="Click again to lose unsaved progress" onConfirm={() => void quit(true)} />
        ) : (
          <button className="btn ghost" onClick={() => void quit().then((ok) => setQuitFailed(!ok))}>Save & quit to title</button>
        )}
      </div>
      {saveError && <p className="bad small center">Last save failed: {saveError}</p>}
      <p className="muted small center">
        {lastSaved ? `Last saved ${timeAgo(lastSaved)}` : 'Not saved yet'} · autosaves after every action
        {saveSystem.persistent ? '' : ' (browser storage unavailable — saves last only this session)'}
      </p>
    </Modal>
  );
}

export function SavesModal({ onClose, forceMode }: { onClose?: () => void; forceMode?: 'save' | 'load' } = {}): JSX.Element {
  const closeDefault = useClose();
  const close = onClose ?? closeDefault;
  const mode = useGame((s) => forceMode ?? s.ui.saveMode);
  const hasGame = useGame((s) => !!s.game);
  const saveSlot = useGame((s) => s.saveSlot);
  const loadSlot = useGame((s) => s.loadSlot);
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);

  const refresh = (): void => void saveSystem.listSlots().then(setSlots);
  useEffect(refresh, []);

  const doLoad = (id: SlotId): void =>
    void loadSlot(id).then((ok) => {
      if (ok && onClose) onClose();
    });

  return (
    <Modal title={mode === 'save' ? 'Save game' : 'Load game'} onClose={close}>
      {!slots ? (
        <p className="muted">Reading saves…</p>
      ) : (
        <ul className="slots">
          {SLOT_IDS.map((id) => {
            const info = slots.find((s) => s.slot === id)!;
            const label = id === 'autosave' ? 'Autosave' : `Slot ${id.slice(-1)}`;
            return (
              <li key={id} className={`slot${info.corrupted ? ' corrupted' : ''}`}>
                <div>
                  <b>{label}</b>
                  {info.empty ? (
                    <span className="muted small">Empty</span>
                  ) : info.corrupted ? (
                    <span className="bad small">Corrupted: {info.error}</span>
                  ) : (
                    <span className="small">
                      Day {info.summary?.day} · {money(info.summary?.cash ?? 0)} · {compact(info.summary?.followers ?? 0)} followers · {info.summary?.clips}{' '}
                      {info.summary?.clips === 1 ? 'clip' : 'clips'}
                      <span className="muted"> · {info.savedAt ? timeAgo(info.savedAt) : ''}</span>
                    </span>
                  )}
                </div>
                <div className="row">
                  {mode === 'save' && hasGame && id !== 'autosave' &&
                    (info.empty ? (
                      <button className="btn primary tiny" onClick={() => void saveSlot(id).then(refresh)}>Save</button>
                    ) : (
                      <ConfirmButton className="btn primary tiny" label="Overwrite" confirmLabel="Confirm overwrite" onConfirm={() => void saveSlot(id).then(refresh)} />
                    ))}
                  {mode === 'load' && !info.empty && !info.corrupted &&
                    (hasGame ? (
                      <ConfirmButton className="btn primary tiny" label="Load" confirmLabel="Lose unsaved progress?" onConfirm={() => doLoad(id)} />
                    ) : (
                      <button className="btn primary tiny" onClick={() => doLoad(id)}>Load</button>
                    ))}
                  {!info.empty && (
                    <ConfirmButton
                      className="btn ghost tiny"
                      label="Delete"
                      confirmLabel="Confirm delete"
                      onConfirm={() => void saveSystem.remove(id).then(refresh)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {mode === 'save' && <p className="muted small">The autosave slot updates automatically after every action and when you close the page.</p>}
    </Modal>
  );
}

export function ConfirmNewModal({ onClose }: { onClose?: () => void } = {}): JSX.Element {
  const closeDefault = useClose();
  const close = onClose ?? closeDefault;
  const newGame = useGame((s) => s.newGame);
  return (
    <Modal title="Start a new game?" onClose={close}>
      <p>
        This starts over with ${BALANCE.startingCash} in the bedroom. Your <b>autosave will be overwritten</b>. Manual save slots are kept.
      </p>
      <div className="row end">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn danger" onClick={() => newGame()}>Start over</button>
      </div>
    </Modal>
  );
}

function SleepModal(): JSX.Element {
  const close = useClose();
  const game = useGame((s) => s.game)!;
  const sleep = useGame((s) => s.sleep);
  const h = hourOf(game.minute);
  const { gain, crash, minutes } = sleepEnergyGain(game);
  const daytime = h >= BALANCE.wakeHour && h < 18;
  const justWoke = h === BALANCE.wakeHour;
  return (
    <Modal title="Go to sleep?" onClose={close}>
      <p>
        It's <b>{formatClock(game.minute)}</b>. You'll wake at 0{BALANCE.wakeHour}:00 ({formatDuration(minutes)} from now) with{' '}
        <b>{Math.min(BALANCE.maxEnergy, game.energy + gain)}</b> energy ({gain >= 0 ? '+' : ''}
        {gain}).
      </p>
      <p className="muted small">
        Energy refills at {BALANCE.sleepEnergyPerHour} per hour slept (full after {Math.ceil(BALANCE.maxEnergy / BALANCE.sleepEnergyPerHour)} h).
        {crash > 0 && <span className="bad"> Too many energy drinks today: −{crash} energy crash in the morning.</span>}
      </p>
      <p className="muted">Your published clips keep collecting views and money while you sleep. Unclipped VODs expire at 0{BALANCE.wakeHour}:00.</p>
      {daytime && (
        <p className="notice">
          {justWoke ? 'You just woke up! ' : ''}It's still daytime — streams are live and moments are going stale. Sleeping now skips the rest of the day.
        </p>
      )}
      <div className="row end">
        <button className="btn ghost" onClick={close}>Stay up</button>
        <button className={`btn ${daytime ? 'danger' : 'primary'}`} onClick={sleep}>
          {daytime ? 'Sleep anyway (skip the day)' : `Sleep until 0${BALANCE.wakeHour}:00`}
        </button>
      </div>
    </Modal>
  );
}

function FridgeModal(): JSX.Element {
  const close = useClose();
  const game = useGame((s) => s.game)!;
  const buy = useGame((s) => s.buyDrink);
  const { energy, maxPerDay, crashPerExtraDrink } = BALANCE.drink;
  const price = drinkPrice(game.drinksToday);
  const left = maxPerDay - game.drinksToday;
  const gain = Math.min(energy, BALANCE.maxEnergy - game.energy);
  return (
    <Modal title="Mini fridge" onClose={close}>
      <p>
        A can of <b>Volt Fizz</b>: +{gain} energy for <b>{money(price)}</b>. {left > 0 ? `You can stomach ${left} more today.` : 'No more today.'}
      </p>
      <p className="muted small">
        Each extra can costs more, and every can after the first means a −{crashPerExtraDrink} energy crash tomorrow morning. Energy {game.energy}/
        {BALANCE.maxEnergy}. Cash {money(game.cash)}.
      </p>
      <div className="row end">
        <button className="btn ghost" onClick={close}>Close</button>
        <button className="btn primary" onClick={buy} disabled={left <= 0 || game.cash < price || game.energy >= BALANCE.maxEnergy}>
          Drink one ({money(price)})
        </button>
      </div>
    </Modal>
  );
}

function TrendsModal(): JSX.Element {
  const close = useClose();
  const game = useGame((s) => s.game)!;
  const day = streamDayOf(game.minute);
  const trends = generateTrends(game.worldSeed, day);
  return (
    <Modal title={`Trend board · Day ${day}`} onClose={close} wide>
      <p className="muted">What each platform's audience is hungry for today. Hot categories get a reach multiplier; cold ones get buried. The board changes every morning at 0{BALANCE.wakeHour}:00.</p>
      <div className="trend-grid">
        {PLATFORM_IDS.map((p) => (
          <div key={p} className="trend-col" style={{ ['--pc' as string]: PLATFORMS[p].color }}>
            <h4>{PLATFORMS[p].name}</h4>
            {MOMENT_CATEGORIES.map((c) => {
              const v = trends[p][c];
              return (
                <div key={c} className={`trend-row${v > 1.05 ? ' hot' : v < 0.95 ? ' cold' : ''}`}>
                  <span style={{ color: CATEGORY_COLOR[c] }}>{CATEGORY_LABEL[c]}</span>
                  <b>{v > 1.05 ? `HOT ×${v}` : v < 0.95 ? `cold ×${v}` : '—'}</b>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function OfflineModal(): JSX.Element {
  const close = useClose();
  const off = useGame((s) => s.ui.offline);
  return (
    <Modal title="While you were away" onClose={close}>
      {off ? (
        <>
          <p>{formatDuration(off.minutes)} of game time passed (offline progress is capped at {BALANCE.offlineCapMinutes / 60} hours).</p>
          <ul className="offline-list">
            <li>+{compact(off.views)} views</li>
            <li>+{compact(off.followers)} followers</li>
            <li>
              {off.cash >= 0 ? '+' : ''}
              {money(off.cash)} cash
            </li>
          </ul>
          {off.highlights.length > 0 && (
            <ul className="small">
              {off.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p>Nothing happened.</p>
      )}
      <div className="row end">
        <button className="btn primary" onClick={close}>Back to work</button>
      </div>
    </Modal>
  );
}

function GameOverModal(): JSX.Element {
  const reason = useGame((s) => s.game?.gameOver ?? 'Game over.');
  const openModal = useGame((s) => s.openModal);
  const quit = useGame((s) => s.quitToTitle);
  return (
    <Modal title="Game over" onClose={() => undefined}>
      <p className="bad">{reason}</p>
      <p className="muted">Your clipping career in this bedroom is over. Load an earlier save or start fresh — and keep an eye on rent next time.</p>
      <div className="menu-list">
        <button className="btn primary" onClick={() => openModal('saves', 'load')}>Load a save…</button>
        <button className="btn danger" onClick={() => openModal('confirm-new')}>New game…</button>
        <button className="btn ghost" onClick={() => void quit(true)}>Back to title</button>
      </div>
    </Modal>
  );
}

export function HelpModal({ onClose }: { onClose?: () => void } = {}): JSX.Element {
  const closeDefault = useClose();
  const close = onClose ?? closeDefault;
  return (
    <Modal title="How to play" onClose={close} wide>
      <ol className="help">
        <li><b>Computer</b> — click the desk (or walk over and press <kbd>E</kbd>) to open your apps.</li>
        <li><b>Streams</b> — pick a streamer who is live or has ended. Scan aired half-hours to find moments. Chat bars are only a hint. Today's VODs stay available until 0{BALANCE.wakeHour}:00 the next morning.</li>
        <li><b>Choose wisely</b> — hype, competition (other clippers), originality and freshness all matter. Old moments are crowded and stale.</li>
        <li><b>Clip Studio</b> — cut tight around the peak and pick a title, hook, subtitles, effects and thumbnail. Every moment has its own taste, and your Editing skill sharpens the quality estimate.</li>
        <li><b>Publish</b> — each platform has its own audience, trends, length preference and monetization rules. Posting the same kind of clip on one platform repeatedly tires its audience. Virality is never guaranteed.</li>
        <li><b>Money</b> — views only pay on monetized platforms. Chirp pays a little from day one; Blink and Tubely pay more once you have enough followers. Rent (${BALANCE.rent.amount}) is due weekly; missing it adds late fees, and {BALANCE.rent.evictAfterMissed} missed weeks gets you evicted.</li>
        <li><b>Rest</b> — the bed skips to 0{BALANCE.wakeHour}:00 and restores energy for the hours slept. Energy drinks get pricier per can and cause a crash. The cat is free.</li>
      </ol>
      <p className="muted small">
        Keys: <kbd>←</kbd>/<kbd>→</kbd> or <kbd>A</kbd>/<kbd>D</kbd> walk · <kbd>E</kbd> interact · <kbd>1</kbd>–<kbd>4</kbd> apps · <kbd>P</kbd> pause · <kbd>Esc</kbd> close/menu
      </p>
    </Modal>
  );
}

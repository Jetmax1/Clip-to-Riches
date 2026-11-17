import { BALANCE } from '../data/balance';
import { totalFollowers } from '../sim/engine';
import { OBJECTIVE_ORDER } from '../sim/initialState';
import { dayOf, daysUntilRent, formatClock, hourOf } from '../sim/time';
import { useGame, type PanelId } from '../state/store';
import { Meter } from './components/Bits';
import { compact, money } from './format';

export const NAV: { id: PanelId; label: string; key: string }[] = [
  { id: 'streams', label: 'Streams', key: '1' },
  { id: 'studio', label: 'Clip Studio', key: '2' },
  { id: 'publish', label: 'Publish', key: '3' },
  { id: 'analytics', label: 'Analytics', key: '4' },
];

/** Future screens, shown locked so players see where the game is going. */
export const LOCKED_NAV = ['Shop', 'Staff', 'Partners', 'Business', 'Achievements'];

export function Hud(): JSX.Element {
  const game = useGame((s) => s.game)!;
  const speed = useGame((s) => s.ui.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const openModal = useGame((s) => s.openModal);
  const h = hourOf(game.minute);
  const late = h >= 23 || h < 5;

  return (
    <header className="hud">
      <div className="hud-group">
        <span className="hud-stat cash" title="Cash">
          <i className="ico ico-cash" aria-hidden />
          {money(game.cash)}
          {game.rentOwed > 0 && (
            <em className="bad small" title={`Missed rent ${game.missedRent}/${BALANCE.rent.evictAfterMissed} weeks — eviction at ${BALANCE.rent.evictAfterMissed}`}>
              {' '}debt {money(game.rentOwed)}
            </em>
          )}
        </span>
        <span className="hud-stat" title="Followers across all platforms">
          <i className="ico ico-fans" aria-hidden />
          {compact(totalFollowers(game))}
        </span>
        <span className="hud-stat" title="Reputation">
          <i className="ico ico-rep" aria-hidden />
          {Math.round(game.reputation)}
        </span>
        <span className="hud-stat" title="Creator level">Lv {game.level}</span>
      </div>
      <div className="hud-group energy" title={`Energy ${game.energy}/${BALANCE.maxEnergy}`}>
        <span className="small">Energy</span>
        <Meter value={game.energy / BALANCE.maxEnergy} color={game.energy < 25 ? '#ff5470' : '#5fd38a'} label="Energy" />
        <b className="small">{game.energy}</b>
      </div>
      <div className="hud-group clock">
        <span className={`hud-time${late ? ' late' : ''}`}>
          Day {dayOf(game.minute)} · {formatClock(game.minute)}
        </span>
        <span className={`small ${game.missedRent > 0 ? 'bad' : 'muted'}`}>
          Rent ${BALANCE.rent.amount} in {daysUntilRent(game.minute)}d{game.missedRent > 0 ? ` · ${game.missedRent}/${BALANCE.rent.evictAfterMissed} missed` : ''}
        </span>
        <div className="speed" role="group" aria-label="Game speed">
          {([0, 1, 3] as const).map((s) => (
            <button key={s} className={`chip${speed === s ? ' active' : ''}`} onClick={() => setSpeed(s)} aria-pressed={speed === s} title={s === 0 ? 'Pause (P)' : `${s}x speed`}>
              {s === 0 ? '❚❚' : `${s}x`}
            </button>
          ))}
        </div>
        <button className="btn tiny" onClick={() => openModal('help')} aria-label="How to play">?</button>
        <button className="btn tiny" onClick={() => openModal('menu')} aria-label="Menu (Esc)">Menu</button>
      </div>
    </header>
  );
}

export function Dock(): JSX.Element {
  const panel = useGame((s) => s.ui.panel);
  const openPanel = useGame((s) => s.openPanel);
  const toast = useGame((s) => s.toast);
  const drafts = useGame((s) => s.game!.drafts);
  const ready = drafts.filter((d) => d.status === 'ready').length;
  const editing = drafts.filter((d) => d.status === 'editing').length;
  return (
    <nav className="dock" aria-label="Main navigation">
      <button className={`dock-btn${panel === null ? ' active' : ''}`} onClick={() => openPanel(null)} title="Main Office (Esc)">
        <span className="dock-ico ico-home" aria-hidden />
        Office
      </button>
      {NAV.map((n) => (
        <button key={n.id} className={`dock-btn${panel === n.id ? ' active' : ''}`} onClick={() => openPanel(n.id)} title={`${n.label} (${n.key})`}>
          <span className={`dock-ico ico-${n.id}`} aria-hidden />
          {n.label}
          {n.id === 'studio' && editing > 0 && <em className="badge">{editing}</em>}
          {n.id === 'publish' && ready > 0 && <em className="badge">{ready}</em>}
        </button>
      ))}
      {LOCKED_NAV.map((l) => (
        <button
          key={l}
          className="dock-btn locked"
          aria-disabled
          title={`${l} — locked`}
          onClick={() => toast({ tone: 'info', text: `${l} is locked. It opens up once your clipping business grows beyond the bedroom (coming in the next update).` })}
        >
          <span className="dock-ico ico-lock" aria-hidden />
          {l}
        </button>
      ))}
    </nav>
  );
}

/** The next first-day goal, or null when all are done. */
export function useNextObjective(): { label: string; done: number; total: number } | null {
  const objectives = useGame((s) => s.game?.objectives);
  if (!objectives) return null;
  const next = OBJECTIVE_ORDER.find((o) => !objectives[o.id]);
  if (!next) return null;
  return { label: next.label, done: OBJECTIVE_ORDER.filter((o) => objectives[o.id]).length, total: OBJECTIVE_ORDER.length };
}

export function Objectives(): JSX.Element | null {
  const panel = useGame((s) => s.ui.panel);
  const goal = useNextObjective();
  // Inside the computer the goal is shown in the window's status strip instead.
  if (!goal || panel) return null;
  const { label: nextLabel, done } = goal;
  const next = { label: nextLabel };
  return (
    <aside className="objectives" aria-live="polite">
      <span className="small muted">
        First day goals {done}/{OBJECTIVE_ORDER.length}
      </span>
      <b>{next.label}</b>
    </aside>
  );
}

export function Toasts(): JSX.Element {
  const toasts = useGame((s) => s.ui.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

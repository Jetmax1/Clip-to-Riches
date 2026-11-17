import { useEffect, useRef } from 'react';
import { useGame } from '../state/store';
import { ErrorBoundary } from './ErrorBoundary';
import { NAV, useNextObjective } from './Hud';
import { Analytics } from './screens/Analytics';
import { ClipStudio } from './screens/ClipStudio';
import { PublishingCenter } from './screens/PublishingCenter';
import { StreamBrowser } from './screens/StreamBrowser';

/** The "monitor" overlay that hosts the computer screens. */
export function ComputerWindow(): JSX.Element | null {
  const panel = useGame((s) => s.ui.panel);
  const openPanel = useGame((s) => s.openPanel);
  const goal = useNextObjective();
  const frame = useRef<HTMLDivElement>(null);
  const isOpen = !!panel;

  // Move keyboard focus into the computer when it opens.
  useEffect(() => {
    if (isOpen) frame.current?.querySelector<HTMLElement>('.tabs button.active')?.focus();
  }, [isOpen]);

  if (!panel) return null;
  return (
    <div className="computer" role="dialog" aria-modal="false" aria-label="Computer">
      <div className="computer-frame" ref={frame}>
        <div className="titlebar">
          <span className="tb-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <nav className="tabs" aria-label="Computer apps">
            {NAV.map((n) => (
              <button key={n.id} className={panel === n.id ? 'active' : ''} onClick={() => openPanel(n.id)} aria-current={panel === n.id}>
                {n.label}
              </button>
            ))}
          </nav>
          <button className="btn tiny close" onClick={() => openPanel(null)} aria-label="Close computer (Esc)">
            ✕
          </button>
        </div>
        {goal && (
          <div className="goal-strip" aria-live="polite">
            <span className="muted">Goal {goal.done + 1}/{goal.total}</span> {goal.label}
          </div>
        )}
        <div className="computer-body">
          <ErrorBoundary key={panel} scope="screen" onBack={() => openPanel(null)}>
            {panel === 'streams' && <StreamBrowser />}
            {panel === 'studio' && <ClipStudio />}
            {panel === 'publish' && <PublishingCenter />}
            {panel === 'analytics' && <Analytics />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

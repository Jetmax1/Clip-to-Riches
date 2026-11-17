import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Where the boundary sits; changes the recovery options offered. */
  scope: 'app' | 'screen';
  onBack?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one bad screen (or bad save data) never blanks the whole game. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] render error', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.scope === 'screen') {
      return (
        <div className="crash" role="alert">
          <h3>This screen hit a problem</h3>
          <p className="muted small">{error.message}</p>
          <div className="row">
            <button className="btn" onClick={this.reset}>Try again</button>
            {this.props.onBack && (
              <button
                className="btn primary"
                onClick={() => {
                  this.reset();
                  this.props.onBack?.();
                }}
              >
                Back to office
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="crash crash-app" role="alert">
        <h2>Something went wrong</h2>
        <p className="muted">{error.message}</p>
        <p className="small">Your last autosave is safe. Reload the page to continue from it, or load another save from the title screen.</p>
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>Reload game</button>
        </div>
      </div>
    );
  }
}

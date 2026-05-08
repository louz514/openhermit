import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Short label shown in the fallback header (e.g. "Chat", "Manage"). */
  label?: string;
  /** Optional custom render function. If omitted, a default panel is shown. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors in a subtree so a single crash doesn't tank the
 * whole app. React 19 still requires a class component for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__inner">
          <h3 className="error-boundary__title">
            {this.props.label ? `${this.props.label} hit an error` : 'Something went wrong'}
          </h3>
          <p className="error-boundary__message">{error.message || String(error)}</p>
          <button type="button" className="btn btn--sm" onClick={this.reset}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}

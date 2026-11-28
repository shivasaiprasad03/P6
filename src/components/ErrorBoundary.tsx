import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level React error boundary preventing full-screen crashes and offering
 * an accessible recovery action.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Details go to the developer console only; users see a plain recovery message.
    if (import.meta.env.DEV) {
      console.error('Section render failed', error, info.componentStack);
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="panel" role="alert">
          <h2 className="panel-title">
            <AlertTriangle size={20} aria-hidden="true" />
            This section failed to load
          </h2>
          <p className="muted">
            Your settings are kept. Try loading it again.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.handleReset}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

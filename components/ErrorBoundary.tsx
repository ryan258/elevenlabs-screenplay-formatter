import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from "@sentry/react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo });
    // You can also log the error to an error reporting service here
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-text-primary p-4">
          <h1 className="text-4xl font-bold text-highlight mb-4">Oops! Something went wrong.</h1>
          <p className="text-lg text-text-secondary mb-8">We're sorry, but an unexpected error occurred. Please try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-highlight text-white font-bold rounded-lg shadow-md hover:bg-highlight-dark transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

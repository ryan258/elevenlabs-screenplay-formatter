import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled rendering error:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary text-text-primary flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-2xl font-bold text-highlight mb-2">Something went wrong.</h1>
          <p className="mb-4 text-sm text-text-secondary">
            {this.state.errorMessage || 'An unexpected error occurred. Reload to try again.'}
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 bg-highlight text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-app-background text-text-primary text-center p-8">
          <h1 className="text-3xl font-bold text-red-400 mb-4">Something went wrong.</h1>
          <p className="text-text-secondary mb-6">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-accent-blue text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
          >
            Refresh Page
          </button>
          <details className="mt-8 text-left bg-card-background p-4 rounded-lg max-w-xl w-full">
            <summary className="cursor-pointer text-text-secondary">Error Details</summary>
            <pre className="mt-2 text-sm text-red-300 whitespace-pre-wrap overflow-auto">
              {this.state.error?.toString()}
              <br />
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
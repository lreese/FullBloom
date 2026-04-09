import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center px-4">
          <h2 className="text-xl font-semibold text-slate-heading">
            Something went wrong
          </h2>
          <p className="text-text-muted text-sm max-w-md">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-md bg-sidebar text-white text-sm font-medium hover:bg-sidebar-hover transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

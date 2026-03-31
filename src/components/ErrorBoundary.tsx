"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-amber-bd bg-amber-bg p-6 text-center">
            <p className="text-sm text-amber-brand">
              予期しないエラーが発生しました。ページをリロードしてください。
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 text-sm text-amber-brand underline hover:text-amber-brand"
            >
              再試行
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

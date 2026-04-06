import { Component, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-start justify-start bg-[#0d0d0d] p-8">
          <div className="max-w-xl space-y-3 select-text">
            <p className="text-[13px] font-semibold text-red-400">Render error</p>
            <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-red-300/70 select-text">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

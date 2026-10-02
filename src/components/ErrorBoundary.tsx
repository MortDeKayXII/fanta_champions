import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Last-resort screen: a crash in one page shows a message instead of a blank site. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-red-200"
      >
        <h2 className="text-lg font-semibold text-red-800">Qualcosa è andato storto</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ricarica la pagina. Se il problema continua, avvisa l&apos;amministratore.
        </p>
        <button
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Ricarica
        </button>
      </div>
    )
  }
}

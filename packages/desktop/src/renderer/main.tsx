import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import "./index.css"

if (!window.api) {
  document.body.style.cssText = "background:#0d0d0d;color:#f87171;padding:24px;font-family:monospace;font-size:13px"
  document.body.innerText = "window.api is undefined — preload script failed to load"
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

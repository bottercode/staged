import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AgentStoreProvider } from "./store/agentStore"
import "./index.css"

if (!window.api) {
  document.body.innerHTML =
    '<div style="color:red;padding:24px;font-family:monospace">window.api is undefined — preload script failed to load</div>'
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AgentStoreProvider>
        <App />
      </AgentStoreProvider>
    </React.StrictMode>
  )
}

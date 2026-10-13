import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tailwind.css";

function renderApp() {
  createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_MSW === 'true') {
  import('./mocks/browser').then(({ worker }) => worker.start().then(() => renderApp()));
} else {
  renderApp();
}

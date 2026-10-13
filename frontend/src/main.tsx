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

if (import.meta.env.DEV) {
  // MSW を開発時に起動し、起動完了後にアプリをレンダリングする
  import('./mocks/browser').then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }).then(() => renderApp()));
} else {
  renderApp();
}

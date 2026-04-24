import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./colors.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found");
}

if (import.meta.env.DEV) {
  // Disable StrictMode in development to avoid double mount/unmount that breaks LG
  createRoot(rootEl).render(<App />);
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted, so text doesn't wait on a third-party stylesheet. Subsets are
// split by unicode-range: a page in English downloads only the Latin file.
import "@fontsource-variable/golos-text";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Entry point for the Mercury React app with ThemeProvider support.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider";
import { App } from "./App";
import "./globals.css";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="mercury-theme">
      <App />
    </ThemeProvider>
  </StrictMode>
);

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
(import.meta.hot.data.root ??= createRoot(elem)).render(app);

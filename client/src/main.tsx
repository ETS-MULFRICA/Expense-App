// Import React's createRoot function to render the app
import { createRoot } from "react-dom/client";
// Import the main App component
import App from "./App";
// Import global CSS styles
import "./index.css";
// Import Vercel Analytics
import { Analytics } from '@vercel/analytics/react';

/**
 * Application Entry Point
 * This function initializes the entire React application
 * - Finds the HTML element with id="root" 
 * - Creates a React root and renders the App component inside it
 * - Includes Vercel Analytics for tracking and performance monitoring
 */
// Load public settings before rendering so utilities can read defaults from window.__APP_SETTINGS__
fetch('/api/settings')
  .then((r) => r.json())
  .then((s) => {
    (window as any).__APP_SETTINGS__ = s || {};
  })
  .catch(() => {
    (window as any).__APP_SETTINGS__ = {};
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <>
        <App />
        <Analytics />
      </>
    );
  });

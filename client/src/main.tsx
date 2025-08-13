// Import React's createRoot function to render the app
import { createRoot } from "react-dom/client";
// Import the main App component
import App from "./App";
// Import global CSS styles
import "./index.css";

/**
 * Application Entry Point
 * This function initializes the entire React application
 * - Finds the HTML element with id="root" 
 * - Creates a React root and renders the App component inside it
 */
createRoot(document.getElementById("root")!).render(<App />);

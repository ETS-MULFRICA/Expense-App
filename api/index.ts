// Setup authentication and session middleware before routes
// Import Express framework and TypeScript types
import express, { type Request, Response, NextFunction } from "express";
// Import our custom API routes
import { registerRoutes } from "./routes";
// Do not import Vite modules at top-level to keep test environment stable.
// We'll dynamically import setupVite/serveStatic when running in development.
import { runMigrationScript } from "./db";

import cors from "cors"; // Add this line
import { corsOptions } from "./cors-config";

import dotenv from 'dotenv';
dotenv.config();

// Minimal logger used by the API. The vite module provides a similar one for the dev server,
// but we avoid importing it at top-level to prevent pulling Vite config into Jest.
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Create Express application instance
const app = express();
//app.use(cors(corsOptions)); // Add this line using the imported corsOptions

// Middleware to parse JSON request bodies
app.use(express.json());
// Middleware to parse URL-encoded form data
app.use(express.urlencoded({ extended: false }));

// Setup authentication and session middleware before routes
import { setupAuth } from "./auth";
setupAuth(app);

/**
 * Request Logging Middleware
 * Logs API requests with timing information and response data
 * - Captures request start time
 * - Intercepts JSON responses to log response data
 * - Calculates and logs request duration
 * - Only logs API routes (paths starting with /api)
 * - Truncates long log lines to keep output readable
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Override res.json to capture response data
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log when response is finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Truncate long log lines for readability
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Server Initialization Function
 * Sets up the entire server with routes, error handling, and static serving
 * - Registers API routes
 * - Sets up error handling middleware
 * - Configures development/production serving
 * - Starts server on port 5000
 */
(async () => {
  // Register all API routes and get HTTP server instance
  const server = await registerRoutes(app);

  /**
   * Global Error Handler Middleware
   * Catches all errors thrown by route handlers
   * - Extracts status code (defaults to 500)
   * - Extracts error message (defaults to "Internal Server Error")
   * - Sends JSON error response
   * - Re-throws error for logging/debugging
   */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Configure serving strategy based on environment
  if (app.get("env") === "development") {
    // Development: dynamically load Vite integration (avoids importing in test env)
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } catch (e) {
      console.warn("Vite dev server setup skipped:", e);
    }
  } else {
    // Production: Serve pre-built static files
    try {
      const { serveStatic } = await import("./vite");
      serveStatic(app);
    } catch (e) {
      console.warn("Static serving setup skipped:", e);
    }
  }

  /**
   * Server Startup
   * Starts the HTTP server on port 5000
   * - Serves both API and client on the same port
   * - Uses 0.0.0.0 to accept connections from any IP
   * - Enables port reuse for development restarts
   */
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    //reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    runMigrationScript();
  });
})();
export default app;
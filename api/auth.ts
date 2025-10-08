import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { pool } from "./db";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcryptjs"; // ✅ switched from bcrypt to bcryptjs

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: User;
    }
  }
}

const scryptAsync = promisify(scrypt);

// ✅ Hash password with scrypt (for normal users)
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// ✅ Compare passwords (supports both bcrypt & scrypt)
async function comparePasswords(supplied: string, stored: string) {
  try {
    if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
      // bcrypt (admin)
      return await bcrypt.compare(supplied, stored);
    } else {
      // scrypt (normal user)
      const [hashed, salt] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    }
  } catch (err) {
    console.error("Password comparison error:", err);
    return false;
  }
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("No SESSION_SECRET env var set, using a default value");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ExpenseTrack-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // ✅ Local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const client = await pool.connect();
      try {
        const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0];
        console.log("Authenticating user:", { username, found: !!user });

        if (!user) return done(null, false);

        const check = await comparePasswords(password, user.password);
        console.log("Password check result:", check);

        if (!check) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      } finally {
        client.release();
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      const user = result.rows[0];
      done(null, user);
    } catch (err) {
      done(err);
    } finally {
      client.release();
    }
  });

  // ✅ Register endpoint
  app.post("/api/register", async (req, res, next) => {
    console.log("[DEBUG] /api/register body:", req.body);

    const client = await pool.connect();
    try {
      const userData = insertUserSchema.parse(req.body);
      const { username, password, name, email } = userData;

      const existingUser = await client.query("SELECT * FROM users WHERE username = $1", [username]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);

      const insertResult = await client.query(
        "INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING id, username, name, email",
        [username, hashedPassword, name, email]
      );

      const user = insertResult.rows[0];

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        next(error);
      }
    } finally {
      client.release();
    }
  });

  // ✅ Login endpoint
  app.post("/api/login", (req, res, next) => {
    console.log("[DEBUG] /api/login body:", req.body);

    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });

      req.login(user, async (err) => {
        if (err) return next(err);

        try {
          const { logActivity, ActivityDescriptions } = await import("./activity-logger");
          await logActivity({
            userId: user.id,
            actionType: "LOGIN",
            resourceType: "USER",
            resourceId: user.id,
            description: ActivityDescriptions.login(user.username),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers["user-agent"],
          });
        } catch (logError) {
          console.error("Failed to log login activity:", logError);
        }

        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // ✅ Logout
  app.post("/api/logout", (req, res, next) => {
    const user = req.user;
    req.logout(async (err) => {
      if (err) return next(err);

      if (user) {
        try {
          const { logActivity, ActivityDescriptions } = await import("./activity-logger");
          await logActivity({
            userId: user.id,
            actionType: "LOGOUT",
            resourceType: "USER",
            resourceId: user.id,
            description: ActivityDescriptions.logout(user.username),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers["user-agent"],
          });
        } catch (logError) {
          console.error("Failed to log logout activity:", logError);
        }
      }

      res.sendStatus(200);
    });
  });

  // ✅ Get current user
  app.get("/api/user", (req, res) => {
    console.log(`[DEBUG] /api/user`, {
      authenticated: req.isAuthenticated(),
      userId: req.user?.id,
      username: req.user?.username,
    });

    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { password, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });
}

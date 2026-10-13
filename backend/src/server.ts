
import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, createHash } from "node:crypto";
import { pool } from "./db.js";
import type { NextFunction } from "express";
const app = express();
const PORT = Number(process.env.PORT || 5000);

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets are missing in .env");
}

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const COOKIE_NAME = "refreshToken";
const COOKIE_PATH = "/api/auth";
const isProduction = process.env.NODE_ENV === "production";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET!, {
    expiresIn: "15m",
    issuer: "my-profile-api",
    audience: "my-profile-client",
  });
}

function createRefreshToken(
  userId: string,
  sessionId: string,
): string {
  return jwt.sign(
    { sub: userId, sid: sessionId, jti: randomUUID() },
    REFRESH_SECRET!,
    {
      expiresIn: "7d",
      issuer: "my-profile-api",
      audience: "my-profile-client",
    },
  );
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: COOKIE_PATH,
  });
}

// Database health check
app.get("/api/health", async (_req, res) => {
  const result = await pool.query("SELECT NOW() AS time");
  res.json({ status: "OK", database: "Connected", time: result.rows[0].time });
});

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" || password.length < 10 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    res.status(400).json({
      message: "Enter a valid name, email and password (10+ characters).",
    });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), email.trim().toLowerCase(), passwordHash],
    );

    const user = result.rows[0];

    await client.query(
      "INSERT INTO profiles (user_id, bio) VALUES ($1, '')",
      [user.id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Registration successful",
      user,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Registration failed" });
  } finally {
    client.release();
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()],
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(user.id, sessionId);

    await pool.query(
      `INSERT INTO refresh_sessions
       (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [sessionId, user.id, hashToken(refreshToken)],
    );

    setRefreshCookie(res, refreshToken);

    res.json({
      message: "Login successful",
      accessToken: createAccessToken(user.id),
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});


app.post("/api/auth/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    res.status(401).json({ message: "Refresh token missing" });
    return;
  }

  const client = await pool.connect();

  try {
    const payload = jwt.verify(token, REFRESH_SECRET!, {
      issuer: "my-profile-api",
      audience: "my-profile-client",
    }) as jwt.JwtPayload;

    const sessionId = payload.sid;
    const userId = payload.sub;

    if (typeof sessionId !== "string" || !userId) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id FROM refresh_sessions
       WHERE id = $1 AND user_id = $2
       AND token_hash = $3 AND revoked_at IS NULL
       AND expires_at > NOW()
       FOR UPDATE`,
      [sessionId, userId, hashToken(token)]
    );

    if (result.rowCount !== 1) {
      await client.query("ROLLBACK");
      clearRefreshCookie(res);
      res.status(401).json({ message: "Session expired or revoked" });
      return;
    }

    const newToken = createRefreshToken(userId, sessionId);

    await client.query(
      `UPDATE refresh_sessions
       SET token_hash = $1, expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $2`,
      [hashToken(newToken), sessionId]
    );

    await client.query("COMMIT");

    setRefreshCookie(res, newToken);

    res.json({ accessToken: createAccessToken(userId) });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    clearRefreshCookie(res);
    res.status(401).json({ message: "Refresh token invalid or expired" });
  } finally {
    client.release();
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      const payload = jwt.verify(token, REFRESH_SECRET!, {
        issuer: "my-profile-api",
        audience: "my-profile-client",
      }) as jwt.JwtPayload;

      if (typeof payload.sid === "string") {
        await pool.query(
          `UPDATE refresh_sessions SET revoked_at = NOW()
           WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
          [payload.sid, hashToken(token)]
        );
      }
    } catch {
      // Invalid token হলেও cookie clear হবে।
    }
  }

  clearRefreshCookie(res);
  res.json({ message: "Logged out successfully" });
});
function authenticateToken(
  req: express.Request,
  res: express.Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ message: "Access token required" });
    return;
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET!, {
      issuer: "my-profile-api",
      audience: "my-profile-client",
    }) as jwt.JwtPayload;

    if (typeof payload.sub !== "string") {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.get("/api/profile", authenticateToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, p.bio
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [res.locals.userId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    res.json({ profile: result.rows[0] });
  } catch {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

app.put("/api/profile", authenticateToken, async (req, res) => {
  const { name, bio } = req.body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100 ||
    typeof bio !== "string" ||
    bio.length > 1000
  ) {
    res.status(400).json({ message: "Invalid name or bio" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users SET name = $1
       WHERE id = $2 RETURNING id, name, email`,
      [name.trim(), res.locals.userId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await pool.query(
      `UPDATE profiles SET bio = $1 WHERE user_id = $2`,
      [bio.trim(), res.locals.userId]
    );

    res.json({ message: "Profile updated", profile: { ...result.rows[0], bio: bio.trim() } });
  } catch {
    res.status(500).json({ message: "Failed to update profile" });
  }
});
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
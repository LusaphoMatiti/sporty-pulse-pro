import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

// ── Helmet ─────────────────────────────────────────────────────────────────

export const helmetMiddleware = [
  helmet(),
  helmet.hsts({ maxAge: 31536000, includeSubDomains: true }), // force HTTPS 1 year
];

// ── CORS ───────────────────────────────────────────────────────────────────

const allowedOrigins = [
  // Add your production frontend URL here when you have one
  "https://sportypulse.vercel.app",
  "http://localhost:5173", // Vite dev (your APP_URL)
  "http://localhost:3000",
  "http://localhost:8081", // Expo web dev
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // React Native mobile apps send no origin header — must allow !origin
    // Web browsers send an origin — check the allowlist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-paystack-signature"],
  credentials: true,
});

// ── Rate limiters ──────────────────────────────────────────────────────────

/**
 * General limiter — applied to all /api/* routes.
 * 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please slow down and try again in 15 minutes.",
  },
});

/**
 * Checkout slow-down — starts adding delay after 5 attempts.
 * Runs BEFORE the hard limiter to progressively penalise abuse.
 */
export const checkoutSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (used) => (used - 5) * 500, // +500ms per attempt over 5
});

/**
 * Checkout hard limiter — 20 checkout initiations per 15 min per IP.
 * Higher than auth because legitimate users may retry failed payments.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many payment attempts. Please try again in 15 minutes.",
  },
});

/**
 * Verify limiter — 30 verifications per 15 min per IP.
 * Prevents reference enumeration attacks.
 */
export const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many verification attempts. Please try again in 15 minutes.",
  },
});

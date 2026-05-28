import express from "express";

import {
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
} from "./middleware/security.js";
import { globalErrorHandler } from "./lib/errors.js";
import paymentsRouter from "./routes/payments.js";

const app = express();

// ── Security middleware ────────────────────────────────────────────────────

app.use(...helmetMiddleware); // HTTP security headers
app.use(corsMiddleware); // Restrict origins
app.use(generalLimiter); // Global rate limit across all routes

// ── Routes ─────────────────────────────────────────────────────────────────

app.use("/payments", paymentsRouter);

// Health check — useful for Vercel and uptime monitors
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Error handler ──────────────────────────────────────────────────────────
// Must be LAST — after all routes.

app.use(globalErrorHandler);

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));

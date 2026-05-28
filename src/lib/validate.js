import { z } from "zod";

// ── Schemas ────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  userId: z.string().min(1, "userId is required").max(255),
  userEmail: z.string().email("Invalid email address").max(255).toLowerCase(),
});

export const verifySchema = z.object({
  reference: z
    .string()
    .min(1, "reference is required")
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid reference format"),
});

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * validate(schema) — validates req.body against a Zod schema.
 * On success, replaces req.body with the cleaned/parsed data.
 * On failure, returns 400 with field-level error details.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * validateQuery(schema) — same but for req.query (GET params).
 */

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.query = result.data;
    next();
  };
}

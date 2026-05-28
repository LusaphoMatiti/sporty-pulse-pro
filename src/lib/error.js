/**
 * globalErrorHandler
 *
 * Catches every error passed via next(err) or thrown in async routes
 * (when wrapped with asyncHandler below).
 *
 * Rule: log everything internally, send nothing sensitive to the client.
 */
export function globalErrorHandler(err, req, res, next) {
  // Internal log — full detail for debugging
  console.error({
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const status = err.status ?? err.statusCode ?? 500;

  // 5xx — never reveal internals
  if (status >= 500) {
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }

  // 4xx — safe to forward the message (set by us, not thrown by a lib)
  return res.status(status).json({
    error: err.message ?? "Bad request",
  });
}

/**
 * asyncHandler(fn)
 *
 * Wraps an async route handler so any rejected promise is forwarded
 * to globalErrorHandler automatically — no try/catch needed in routes.
 *
 * Usage:
 *   router.post("/route", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

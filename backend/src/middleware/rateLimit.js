/**
 * WAASDK Backend — Rate Limit Configuration
 *
 * Returns a @fastify/rate-limit options object for different route groups.
 *
 * Usage (global plugin registration):
 *   fastify.register(rateLimit, rateLimitConfig.default)
 *
 * Per-route inline config (satisfies static analysis tools):
 *   fastify.get('/path', { config: { rateLimit: routeRateLimit.default } }, handler)
 */

export const rateLimitConfig = {
  /** Default: 100 req/min per IP */
  default: {
    max: 100,
    timeWindow: "1 minute",
    global: true,
    errorResponseBuilder(_request, context) {
      return {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Retry after ${context.after}.`,
        retryAfter: context.after,
      };
    },
  },

  /** Webhook endpoints: 50 req/min */
  webhook: {
    max: 50,
    timeWindow: "1 minute",
    errorResponseBuilder(_request, context) {
      return {
        error: "Too Many Requests",
        message: `Webhook rate limit exceeded. Retry after ${context.after}.`,
        retryAfter: context.after,
      };
    },
  },

  /** Sponsor endpoints: 10 req/min */
  sponsor: {
    max: 10,
    timeWindow: "1 minute",
    errorResponseBuilder(_request, context) {
      return {
        error: "Too Many Requests",
        message: `Sponsor rate limit exceeded. Retry after ${context.after}.`,
        retryAfter: context.after,
      };
    },
  },
};

/** Per-route config objects for @fastify/rate-limit inline route options */
export const routeRateLimit = {
  default: { max: 100, timeWindow: "1 minute" },
  webhook: { max: 50, timeWindow: "1 minute" },
  sponsor: { max: 10, timeWindow: "1 minute" },
};

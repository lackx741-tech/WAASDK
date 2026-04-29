/**
 * WAASDK Backend — Rate Limit Configuration
 *
 * Returns a @fastify/rate-limit options object for different route groups.
 *
 * Usage:
 *   fastify.register(rateLimit, rateLimitConfig.default)
 *   fastify.register(rateLimit, rateLimitConfig.webhook)
 *   fastify.register(rateLimit, rateLimitConfig.sponsor)
 */

export const rateLimitConfig = {
  /** Default: 100 req/min per IP */
  default: {
    max: 100,
    timeWindow: "1 minute",
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

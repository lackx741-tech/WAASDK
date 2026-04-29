/**
 * Analytics API routes.
 *
 * GET /api/analytics/overview  — aggregated counts and totals
 */

import { Session }     from '../models/Session.js';
import { Transaction } from '../models/Transaction.js';

/**
 * Register analytics routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function analyticsRoutes(fastify) {
  // GET /api/analytics/overview
  fastify.get('/overview', async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);

    const [
      totalSessions,
      activeSessions,
      revokedSessions,
      totalTxs,
      pendingTxs,
      confirmedTxs,
    ] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
      Session.countDocuments({ status: 'revoked' }),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: 'pending' }),
      Transaction.countDocuments({ status: 'confirmed' }),
    ]);

    return reply.send({
      sessions: {
        total:   totalSessions,
        active:  activeSessions,
        revoked: revokedSessions,
      },
      transactions: {
        total:     totalTxs,
        pending:   pendingTxs,
        confirmed: confirmedTxs,
      },
    });
  });
}

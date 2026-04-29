/**
 * Sessions API routes.
 *
 * GET    /api/sessions/active        — all active sessions
 * GET    /api/sessions/:address      — sessions for a specific owner
 * DELETE /api/sessions/:sessionKey   — revoke (mark as revoked) a session
 */

import { Session } from '../models/Session.js';

/**
 * Register session routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function sessionRoutes(fastify) {
  // GET /api/sessions/active
  fastify.get('/active', async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);
    const sessions = await Session.find({
      status:    'active',
      expiresAt: { $gt: now },
    }).lean();
    return reply.send({ sessions });
  });

  // GET /api/sessions/:address
  fastify.get('/:address', async (req, reply) => {
    const sessions = await Session.find({ owner: req.params.address }).lean();
    return reply.send({ sessions });
  });

  // DELETE /api/sessions/:sessionKey
  fastify.delete('/:sessionKey', async (req, reply) => {
    const result = await Session.findOneAndUpdate(
      { sessionKey: req.params.sessionKey },
      { status: 'revoked' },
      { new: true },
    );
    if (!result) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.send({ success: true, session: result });
  });
}

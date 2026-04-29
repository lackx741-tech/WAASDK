/**
 * Transactions API routes.
 *
 * POST /api/transactions   — log a new transaction
 * GET  /api/transactions   — list transactions (paginated)
 */

import { Transaction } from '../models/Transaction.js';
import { alertSessionTx } from '../telegram.js';

/**
 * Register transaction routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function transactionRoutes(fastify) {
  // POST /api/transactions
  fastify.post('/', async (req, reply) => {
    const body = req.body;

    const tx = await Transaction.create({
      txHash:     body.txHash,
      from:       body.from,
      to:         body.to,
      value:      body.value,
      data:       body.data,
      chainId:    body.chainId,
      sessionKey: body.sessionKey,
      type:       body.type ?? 'other',
      status:     body.status ?? 'pending',
      meta:       body.meta,
    });

    if (body.sessionKey && body.txHash) {
      await alertSessionTx({
        sessionKey:   body.sessionKey,
        txHash:       body.txHash,
        functionName: body.meta?.functionName,
        chainId:      body.chainId,
      });
    }

    return reply.status(201).send({ transaction: tx });
  });

  // GET /api/transactions?page=1&limit=20
  fastify.get('/', async (req, reply) => {
    const page  = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));

    const [transactions, total] = await Promise.all([
      Transaction.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(),
    ]);

    return reply.send({ transactions, total, page, limit });
  });
}

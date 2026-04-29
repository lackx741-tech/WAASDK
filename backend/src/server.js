/**
 * IntegratedDEX WaaS SDK — Production Backend
 *
 * Fastify server with:
 *  - MongoDB persistence (sessions + transactions)
 *  - Telegram alerts on every key event
 *  - On-chain event indexer (SessionManager across all configured chains)
 *  - REST API consumed by the frontend SDK
 *
 * Start: node src/server.js
 * Config: copy .env.example to .env and fill in values
 */

import Fastify         from 'fastify';
import cors            from '@fastify/cors';
import helmet          from '@fastify/helmet';
import rateLimit       from '@fastify/rate-limit';
import cron            from 'node-cron';
import { connect }     from './db.js';
import { startIndexer, stopIndexer } from './indexer.js';
import { sessionRoutes }     from './routes/sessions.js';
import { transactionRoutes } from './routes/transactions.js';
import { analyticsRoutes }   from './routes/analytics.js';
import { webhookRoutes }     from './routes/webhook.js';
import { alertDailySummary } from './telegram.js';
import { Session }           from './models/Session.js';
import { Transaction }       from './models/Transaction.js';
import { PORT, HOST, API_KEY } from './config.js';

// ─── Create Server ────────────────────────────────────────────────────────────

const fastify = Fastify({ logger: true });

// ─── Plugins ──────────────────────────────────────────────────────────────────

await fastify.register(cors,      { origin: true });
await fastify.register(helmet,    { global: true });
await fastify.register(rateLimit, { max: 200, timeWindow: '1 minute' });

// ─── API Key Middleware ───────────────────────────────────────────────────────

fastify.addHook('onRequest', async (req, reply) => {
  // Skip auth for public endpoints
  const publicPaths = ['/api/health'];
  if (publicPaths.includes(req.url)) return;

  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

fastify.get('/api/health', async () => ({
  status:    'ok',
  timestamp: new Date().toISOString(),
}));

fastify.register(sessionRoutes,     { prefix: '/api/sessions' });
fastify.register(transactionRoutes, { prefix: '/api/transactions' });
fastify.register(analyticsRoutes,   { prefix: '/api/analytics' });
fastify.register(webhookRoutes,     { prefix: '/api/webhook' });

// ─── Daily Summary Cron (08:00 UTC) ──────────────────────────────────────────

cron.schedule('0 8 * * *', async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const [totalSessions, activeSessions, totalTxs] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
      Transaction.countDocuments(),
    ]);
    await alertDailySummary({
      totalSessions,
      activeSessions,
      totalTxs,
      date: new Date().toDateString(),
    });
  } catch (err) {
    fastify.log.error('[cron] daily summary error:', err.message);
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  await connect();
  await startIndexer();
  await fastify.listen({ port: PORT, host: HOST });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  fastify.log.info(`[server] ${signal} received — shutting down`);
  await stopIndexer();
  await fastify.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('[server] startup error:', err);
  process.exit(1);
});

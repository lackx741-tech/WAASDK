/**
 * MongoDB initialization script — runs once on first container start.
 * Creates the application database user with readWrite permissions.
 *
 * The MONGO_PASSWORD env var is read from docker-compose.prod.yml.
 */

db = db.getSiblingDB("waassdk");

db.createUser({
  user: "waassdk_user",
  pwd: process.env.MONGO_PASSWORD || "changeme_in_production",
  roles: [{ role: "readWrite", db: "waassdk" }],
});

// Create indexes for common queries
db.createCollection("sessions");
db.sessions.createIndex({ id: 1 }, { unique: true });
db.sessions.createIndex({ userAddress: 1 });
db.sessions.createIndex({ status: 1, expiresAt: 1 });
db.sessions.createIndex({ createdAt: 1 });

db.createCollection("transactions");
db.transactions.createIndex({ txHash: 1 }, { unique: true });
db.transactions.createIndex({ userAddress: 1 });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ timestamp: -1 });
db.transactions.createIndex({ chainId: 1 });

db.createCollection("contributors");
db.contributors.createIndex({ address: 1 }, { unique: true });
db.contributors.createIndex({ lastContributedAt: -1 });

print("✅ waassdk database initialized with indexes");

import { MongoClient } from 'mongodb';

const globalForMongo = globalThis;

function getClientPromise() {
  if (!globalForMongo.__jdOutreachMongoClientPromise) {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
    const client = new MongoClient(uri);
    globalForMongo.__jdOutreachMongoClientPromise = client.connect();
  }
  return globalForMongo.__jdOutreachMongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  const dbName = process.env.MONGODB_DB || 'jd_outreach';
  return client.db(dbName);
}

let indexesEnsuredPromise = null;

async function runEnsureIndexes(collections) {
  try {
    await Promise.all([
      collections.users.createIndex({ email: 1 }, { unique: true }),
      collections.users.createIndex({ emailVerificationTokenHash: 1 }, { sparse: true }),
      collections.users.createIndex({ deletion_status: 1, scheduled_purge_at: 1 }),
      collections.profiles.createIndex({ user_id: 1 }, { unique: true }),
      collections.playbookExamples.createIndex({ user_id: 1, created_at: -1 }),
      collections.generations.createIndex({ user_id: 1, created_at: -1 }),
      collections.generations.createIndex({ user_id: 1, company_name: 1, created_at: -1 }),
      collections.consentEvents.createIndex({ user_id: 1, event_type: 1, created_at: -1 }),
      collections.accountLifecycleLogs.createIndex({ user_id: 1, created_at: -1 }),
      collections.llmUsageLogs.createIndex({ user_id: 1, created_at: -1 }),
      collections.llmUsageLogs.createIndex({ generation_id: 1 }),
      collections.llmUsageLogs.createIndex({ created_at: -1 }),
      collections.llmUsageLogs.createIndex({ action: 1, created_at: -1 }),
      collections.externalApiLogs.createIndex({ generation_id: 1 }),
      collections.externalApiLogs.createIndex({ provider: 1, created_at: -1 }),
      collections.externalApiLogs.createIndex({ user_id: 1, created_at: -1 }),
      collections.generationCostLogs.createIndex({ generation_id: 1 }, { unique: true }),
      collections.generationCostLogs.createIndex({ user_id: 1, created_at: -1 }),
      collections.generationCostLogs.createIndex({ created_at: -1 }),
      collections.creditTransactions.createIndex({ user_id: 1, created_at: -1 }),
      collections.creditTransactions.createIndex({ generation_id: 1 }),
      collections.creditTransactions.createIndex({ type: 1, created_at: -1 }),
    ]);
  } catch (err) {
    console.error('[mongodb] Error creating indexes:', err);
  }
}

export async function getCollections() {
  const db = await getDb();
  const collections = {
    users: db.collection('users'),
    profiles: db.collection('profiles'),
    playbookExamples: db.collection('playbook_examples'),
    generations: db.collection('generations'),
    consentEvents: db.collection('consent_events'),
    accountLifecycleLogs: db.collection('account_lifecycle_logs'),
    llmUsageLogs: db.collection('llm_usage_logs'),
    externalApiLogs: db.collection('external_api_logs'),
    generationCostLogs: db.collection('generation_cost_logs'),
    creditTransactions: db.collection('credit_transactions'),
  };

  if (!indexesEnsuredPromise) {
    indexesEnsuredPromise = runEnsureIndexes(collections);
  }

  return collections;
}

export async function ensureIndexes() {
  const collections = await getCollections();
  return runEnsureIndexes(collections);
}

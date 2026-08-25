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
      collections.profiles.createIndex({ user_id: 1 }, { unique: true }),
      collections.playbookExamples.createIndex({ user_id: 1, created_at: -1 }),
      collections.generations.createIndex({ user_id: 1, created_at: -1 }),
      collections.generations.createIndex({ user_id: 1, company_name: 1, created_at: -1 }),
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

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'jd_outreach';

export async function runWorkAuthMigration(customClient = null, customDb = null) {
  let client = customClient;
  let shouldClose = false;

  if (!client && !customDb) {
    client = new MongoClient(uri);
    await client.connect();
    shouldClose = true;
  }

  const db = customDb || client.db(dbName);
  const profiles = db.collection('profiles');

  console.log(`[migration] Starting migration to remove work_auth from "${dbName}.profiles"...`);

  // Unset all variations of work_auth / work_authorization
  const result = await profiles.updateMany(
    {},
    {
      $unset: {
        work_auth: '',
        workAuth: '',
        work_authorization: '',
        workAuthorization: '',
      },
    }
  );

  console.log(`[migration] Successfully migrated profiles: matched ${result.matchedCount}, modified ${result.modifiedCount}`);

  if (shouldClose && client) {
    await client.close();
  }

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
}

// If invoked directly from CLI
if (process.argv[1] && (process.argv[1].endsWith('migrate-remove-work-auth.js') || process.argv[1].includes('migrate-remove-work-auth'))) {
  runWorkAuthMigration()
    .then((res) => {
      console.log('[migration] Migration completed successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migration] Migration failed:', err);
      process.exit(1);
    });
}

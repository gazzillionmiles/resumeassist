// Backwards-compatible database facade. New code should import from ./mongodb.js.
export { getDb, getCollections, ensureIndexes } from './mongodb.js';

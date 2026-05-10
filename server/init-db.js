import 'dotenv/config';
import { initSchema } from './schema.js';
import { dbPath } from './db.js';

await initSchema();
console.log(`SQLite database initialized: ${dbPath}`);
process.exit(0);

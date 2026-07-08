import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Each test FILE gets its own isolated JSON "database" file, so tests never touch
// server/data/db.json and different test files never race on the same file.
process.env.SKBOT_DB_FILE = path.join(os.tmpdir(), `skbot-test-db-${randomUUID()}.json`);

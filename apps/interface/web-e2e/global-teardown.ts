import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

export default async function globalTeardown() {
  // Clean up state file — Testcontainers Ryuk handles container cleanup
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

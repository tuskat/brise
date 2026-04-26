import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const ENTRY = path.join(PROJECT_ROOT, 'dist/server/entry.mjs');

export async function startServer() {
  if (!existsSync(ENTRY)) {
    throw new Error(
      `Built SSR entry not found at ${ENTRY}. Run "npm run build" first.`
    );
  }

  const cwd = mkdtempSync(path.join(tmpdir(), 'brise-test-'));
  // format-extractor reads ./format-schemas from cwd; symlink so it resolves.
  symlinkSync(path.join(PROJECT_ROOT, 'format-schemas'), path.join(cwd, 'format-schemas'));

  const port = 4400 + Math.floor(Math.random() * 500);
  const proc = spawn('node', [ENTRY], {
    cwd,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    proc.stdout.on('data', (d) => {
      if (d.toString().includes('Server listening')) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(`[ssr] ${d}`));
    proc.on('exit', (code) => reject(new Error(`Server exited early: ${code}`)));
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async stop() {
      proc.kill('SIGTERM');
      await new Promise((r) => proc.on('exit', r));
      rmSync(cwd, { recursive: true, force: true });
    }
  };
}

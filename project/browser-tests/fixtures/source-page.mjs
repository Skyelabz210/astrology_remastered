// Source entrypoints are deliberately separate from the dist preview server:
// wiring tests must load the checked-in HTML and native ES-module graph.
import { test as base, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export const test = base.extend({
  // Playwright requires destructuring even when a fixture has no dependencies.
  // eslint-disable-next-line no-empty-pattern
  sourceURL: [async ({}, use) => {
    const sourceRoot = resolve(root);
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(sourceRoot, '.' + pathname);
        if (!file.startsWith(sourceRoot + sep)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        const data = await readFile(file);
        res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
        res.end(data);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      await use(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, { scope: 'worker' }],
});
export { expect };

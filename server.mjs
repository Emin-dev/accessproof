// Minimal static file server for local preview. Zero dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = process.env.PORT || 8097;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://localhost`).pathname);
    if (path === '/') path = '/index.html';
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, safe);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // Local preview only: never cache, so edits are always picked up on reload.
      'cache-control': 'no-store, max-age=0',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`AccessProof preview on http://localhost:${PORT}`));

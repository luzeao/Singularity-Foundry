import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requested = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const info = await stat(requested);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'Content-Type': types[extname(requested)] ?? 'application/octet-stream' });
    createReadStream(requested).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4174, '127.0.0.1', () => {
  console.log('Singularity Foundry: http://127.0.0.1:4174');
});

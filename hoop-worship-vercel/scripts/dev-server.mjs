import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleImport } from '../server/import-service.mjs';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/api/import-song') {
            const body = [];
            let length = 0;
            for await (const chunk of req) { length += chunk.length; if (length > 4096) { res.writeHead(413); res.end(); return; } body.push(chunk); }
            const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(body) } : {}) });
            const response = await handleImport(request);
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(Buffer.from(await response.arrayBuffer()));
            return;
        }
        const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!path.startsWith(root + sep) && path !== resolve(root, 'index.html')) throw new Error('Invalid path');
        // Serve only development assets/tests, never backend source or configuration.
        if (url.pathname.startsWith('/server/') || url.pathname.startsWith('/scripts/') || /wrangler|\.git/.test(url.pathname)) { res.writeHead(403); res.end(); return; }
        const data = await readFile(path);
        res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 8001), '127.0.0.1', () => console.log('Hoop Worship development: http://127.0.0.1:' + (process.env.PORT || 8001)));

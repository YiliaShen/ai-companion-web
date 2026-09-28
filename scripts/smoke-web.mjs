import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDist } from './verify-dist.mjs';

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown'
};

// A strict static server: missing files and unknown paths do not fall back to the
// app shell, matching GitHub Pages rather than Vite's development SPA fallback.
export async function startStaticServer(root, base) {
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (base !== '/' && pathname === base.slice(0, -1)) {
        response.writeHead(308, { Location: base }).end();
        return;
      }
      if (!pathname.startsWith(base)) {
        response.writeHead(404).end('Not found');
        return;
      }
      const relative = pathname.slice(base.length) || 'index.html';
      const file = resolve(root, relative);
      if (!file.startsWith(`${resolve(root)}${sep}`)) {
        response.writeHead(404).end('Not found');
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store'
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 400).end('Not found');
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}${base}`,
    close: () => new Promise((accept, reject) => server.close((error) => error ? reject(error) : accept()))
  };
}

export async function smokeWeb({ url } = {}) {
  const result = await verifyDist();
  const local = url ? null : await startStaticServer(result.root, result.base);
  try {
    const target = new URL(url ?? local.url);
    assert(['http:', 'https:'].includes(target.protocol), 'Smoke URL must use HTTP(S)');
    assert.equal(target.pathname, result.base, `Smoke URL must include build base ${result.base}, including the trailing slash`);
    assert(!target.search && !target.hash, 'Smoke URL must be a base URL without query or fragment');
    const resources = ['', ...result.files.filter((file) => file !== 'index.html')];
    for (const resource of resources) {
      const response = await fetch(new URL(resource, target), { signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, 200, `HTTP ${response.status}: ${resource || result.base}`);
      const expectedType = mimeTypes[extname(resource || 'index.html')];
      if (expectedType && expectedType !== 'text/markdown') {
        const receivedType = response.headers.get('content-type') ?? '';
        const validTypes = expectedType === 'text/javascript' ? ['text/javascript', 'application/javascript']
          : expectedType === 'application/manifest+json' ? ['application/manifest+json', 'application/json'] : [expectedType];
        assert(validTypes.some((type) => receivedType.split(';')[0] === type), `Wrong Content-Type for ${resource}: ${receivedType}`);
      }
      const body = Buffer.from(await response.arrayBuffer());
      const expected = await readFile(resolve(result.root, resource || 'index.html'));
      assert(body.equals(expected), `Served content differs from dist (or returned an HTML fallback): ${resource || result.base}`);
    }
    // These negative checks apply to the local Pages-like server, not custom
    // remote 404 pages or hosting configurations.
    if (local) {
      const missing = await fetch(new URL('assets/does-not-exist.jpg', target));
      assert.equal(missing.status, 404, 'Missing assets must return 404');
      if (result.base !== '/') {
        const wrongBase = await fetch(new URL('/assets/manifest.json', target));
        assert.equal(wrongBase.status, 404, 'Root URLs must not hide a broken project base');
        const redirect = await fetch(new URL(result.base.slice(0, -1), target), { redirect: 'manual' });
        assert.equal(redirect.status, 308, 'Project root must redirect to its trailing-slash URL');
      }
    }
    console.log(`HTTP smoke passed: ${resources.length} resources at ${target.href}; ${result.assetCount} photos served with exact build bytes.`);
    return result;
  } finally {
    await local?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    assert(args.length === 0 || (args.length === 2 && args[0] === '--url'), 'Usage: node scripts/smoke-web.mjs [--url https://owner.github.io/ai-companion-web/]');
    await smokeWeb({ url: args[1] });
  } catch (error) {
    console.error(`HTTP smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}

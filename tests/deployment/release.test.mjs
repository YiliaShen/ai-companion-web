import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { localPath, normalizeBase, projectRoot, verifyAssets } from '../../scripts/verify-dist.mjs';
import { startStaticServer } from '../../scripts/smoke-web.mjs';

const tempDirectories = [];
afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory() {
  const directory = await mkdtemp(resolve(tmpdir(), 'mira-release-'));
  tempDirectories.push(directory);
  return directory;
}

describe('release asset integrity', () => {
  it('ships complete, attributed, hash-verified portraits and five scenes', async () => {
    const result = await verifyAssets(resolve(projectRoot, 'public'));
    expect(result.count).toBe(11);
    expect(result.bytes).toBeLessThan(2_000_000);
  });

  it('rejects an image changed without updating its manifest', async () => {
    const root = await temporaryDirectory();
    await cp(resolve(projectRoot, 'public/assets'), resolve(root, 'assets'), { recursive: true });
    const image = resolve(root, 'assets/personas/shenxu-avatar.jpg');
    const bytes = await readFile(image);
    bytes[bytes.length - 100] ^= 1;
    await writeFile(image, bytes);
    await expect(verifyAssets(root)).rejects.toThrow('Image hash differs');
  });

  it('rejects a missing scene photo', async () => {
    const root = await temporaryDirectory();
    await cp(resolve(projectRoot, 'public/assets'), resolve(root, 'assets'), { recursive: true });
    await rm(resolve(root, 'assets/scenes/seaside.jpg'));
    await expect(verifyAssets(root)).rejects.toThrow('ENOENT');
  });
});

describe('GitHub Pages URL behavior', () => {
  it('resolves project-relative assets and rejects root URLs and traversal', () => {
    const base = normalizeBase('/ai-companion-web');
    expect(base).toBe('/ai-companion-web/');
    expect(normalizeBase('./')).toBe('/');
    expect(localPath('assets/photo.jpg', base)).toBe('assets/photo.jpg');
    expect(localPath('/ai-companion-web/assets/photo.jpg', base)).toBe('assets/photo.jpg');
    expect(localPath('https://fonts.googleapis.com/css2', base)).toBeNull();
    expect(() => localPath('/assets/photo.jpg', base)).toThrow('escapes deployment base');
    expect(() => localPath('../private.jpg', base)).toThrow('escapes deployment base');
    expect(() => localPath('assets/%2e%2e%2fprivate.jpg', base)).toThrow('Invalid local reference');
  });

  it('serves the project prefix and does not mask missing files with the SPA shell', async () => {
    const root = await temporaryDirectory();
    await writeFile(resolve(root, 'index.html'), '<main>Mira</main>');
    const server = await startStaticServer(root, '/ai-companion-web/');
    try {
      const response = await fetch(server.url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<main>Mira</main>');
      expect((await fetch(new URL('missing.jpg', server.url))).status).toBe(404);
      expect((await fetch(new URL('/index.html', server.url))).status).toBe(404);
      const redirect = await fetch(server.url.slice(0, -1), { redirect: 'manual' });
      expect(redirect.status).toBe(308);
      expect(redirect.headers.get('location')).toBe('/ai-companion-web/');
    } finally {
      await server.close();
    }
  });
});

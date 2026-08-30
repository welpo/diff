import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HASHED_ASSETS = [
  'diff.js',
  'grid.js',
  'styles.css',
  'manifest.json',
  'diff.worker.js',
  'sw-registration.js',
  'app.js',
];

const UNHASHED_ASSETS = [
  'index.html',
  'icon-192x192.png',
  'icon-512x512.png',
  'apple-touch-icon.png',
  'favicon.ico',
];

const REFERRING_FILES = [
  'index.html',
  'app.js',
  'diff.worker.js',
  'sw-registration.js',
];

const appPath = (name) => fileURLToPath(new URL(`../app/${name}`, import.meta.url));
const read = (name) => readFileSync(appPath(name), 'utf8');
const hashOf = (name) =>
  createHash('md5').update(readFileSync(appPath(name))).digest('hex').slice(0, 8);

const serviceWorker = read('sw.js');

describe('Service worker precache manifest', () => {
  it('lists every asset with its current hash', () => {
    for (const name of HASHED_ASSETS) {
      assert.ok(
        serviceWorker.includes(`'./${name}?h=${hashOf(name)}'`),
        `app/sw.js does not precache the current ${name}`,
      );
    }
    for (const name of UNHASHED_ASSETS.filter((n) => n !== 'index.html')) {
      assert.ok(serviceWorker.includes(`'./${name}'`), `app/sw.js does not precache ${name}`);
    }
  });
});

describe('Cache-busted references', () => {
  for (const file of REFERRING_FILES) {
    it(`${file} points at current hashes`, () => {
      const references = [...read(file).matchAll(/([\w.-]+)\?h=([a-f0-9]{8})/g)];
      for (const [, name, hash] of references) {
        assert.strictEqual(hash, hashOf(name), `${file} points at a stale ${name}`);
      }
    });
  }
});

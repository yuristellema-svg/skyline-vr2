import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

export function createFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'skyline-aircraft-visual-'));
  fs.mkdirSync(path.join(fixture, 'src', 'aircraft'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'vendor'), { recursive: true });

  for (const file of fs.readdirSync(path.join(packageRoot, 'src', 'aircraft'))) {
    fs.copyFileSync(
      path.join(packageRoot, 'src', 'aircraft', file),
      path.join(fixture, 'src', 'aircraft', file),
    );
  }

  fs.copyFileSync(
    path.join(packageRoot, 'tests', 'helpers', 'threeStub.mjs'),
    path.join(fixture, 'vendor', 'three.module.min.js'),
  );

  return {
    root: fixture,
    async importModule(name) {
      const url = pathToFileURL(path.join(fixture, 'src', 'aircraft', name));
      url.searchParams.set('cache', `${Date.now()}-${Math.random()}`);
      return import(url.href);
    },
    cleanup() {
      fs.rmSync(fixture, { recursive: true, force: true });
    },
  };
}

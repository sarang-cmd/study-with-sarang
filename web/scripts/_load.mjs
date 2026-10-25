import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

/** Bundles a TypeScript module for Node so the tests exercise the real source. */
export async function loadModule(entry) {
  const temp = await mkdtemp(path.join(tmpdir(), 'sws-test-'));
  const output = path.join(temp, 'module.mjs');
  await build({ entryPoints: [entry], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const module = await import(pathToFileURL(output).href + `?t=${Date.now()}`);
  await rm(temp, { recursive: true, force: true });
  return module;
}

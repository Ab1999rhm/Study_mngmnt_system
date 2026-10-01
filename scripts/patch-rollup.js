// Windows Application Control blocks rollup's native .node binary.
// This replaces rollup's native entry with the pure-JS WASM build (@rollup/wasm-node).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'node_modules', 'rollup', 'dist', 'native.js');

const desired = `/*patched-wasm*/
const wasm = require('@rollup/wasm-node/dist/native.js');
exports.parse = wasm.parse;
exports.parseAsync = wasm.parseAsync;
exports.xxhashBase64Url = wasm.xxhashBase64Url;
exports.xxhashBase36 = wasm.xxhashBase36;
exports.xxhashBase16 = wasm.xxhashBase16;
if (typeof wasm.flushLlvmCoverage === 'function') exports.flushLlvmCoverage = wasm.flushLlvmCoverage;
`;

if (fs.existsSync(target)) {
  const current = fs.readFileSync(target, 'utf8');
  if (current !== desired) {
    fs.writeFileSync(target, desired);
    console.log('[patch-rollup] rollup native.js -> @rollup/wasm-node');
  }
}
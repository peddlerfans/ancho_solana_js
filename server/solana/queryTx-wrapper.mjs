// server/solana/queryTx-wrapper.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireCjs = createRequire(import.meta.url);
const cjsPath = join(process.cwd(), 'server', 'solana', 'queryTx.cjs');

let queryTx;
try {
  ({ queryTx } = requireCjs(cjsPath));
} catch (e) {
  console.error('require queryTx.cjs failed at', cjsPath, e);
  throw e;
}

export { queryTx };

// server/solana/queryTx-wrapper.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireCjs = createRequire(import.meta.url);

// 绝对路径到项目根的 CJS 文件（确保部署时项目根含有 server/solana/queryTx.cjs）
const cjsPath = join(process.cwd(), 'server', 'solana', 'queryTx.cjs');

let queryTx;
try {
  // 这里使用绝对路径 require，避免相对路径被 .output 重写导致找不到
  ({ queryTx } = requireCjs(cjsPath));
} catch (e) {
  console.error('failed to require queryTx.cjs at', cjsPath, e);
  throw e;
}

export { queryTx };

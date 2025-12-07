import { createRequire } from "node:module";
import { join } from "node:path";

const requireCjs = createRequire(import.meta.url);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { signature, mint } = body || {};

  if (!signature || !mint) {
    return { status: "error", message: "missing params" };
  }

  // ✅ 永远指向 .output/server/solana
  const queryTxPath = join(
    process.cwd(),
    ".output",
    "server",
    "solana",
    "queryTx.cjs"
  );

  const { queryTx } = requireCjs(queryTxPath);

  const result = await queryTx(signature, mint);

  return {
    status: "success",
    data: result,
  };
});

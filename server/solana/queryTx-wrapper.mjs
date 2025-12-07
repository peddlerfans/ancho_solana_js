import { createRequire } from "node:module";
import { join } from "node:path";

const requireCjs = createRequire(import.meta.url);

export default defineEventHandler(async (event) => {
  const { signature, mint } = await readBody(event);

  const cjsPath = join(
    process.cwd(),
    ".output",
    "server",
    "solana",
    "queryTx.cjs"
  );

  const { queryTx } = requireCjs(cjsPath);

  const result = await queryTx(signature, mint);

  return {
    ok: true,
    result,
  };
});

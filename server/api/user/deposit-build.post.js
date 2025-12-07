// server/api/user/deposit-build.post.js
import { createRequire } from "node:module";
import { join } from "node:path";

const requireCjs = createRequire(import.meta.url);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userPubkey, amount, mint } = body || {};

  if (!userPubkey || !amount) {
    throw createError({ statusCode: 400, statusMessage: "missing params" });
  }

  // 优先从 .output/server/solana 读取（生产）
  const prodPath = join(
    process.cwd(),
    ".output",
    "server",
    "solana",
    "deposit.cjs"
  );

  let mod;
  try {
    mod = requireCjs(prodPath);
  } catch (e) {
    console.error("Failed to load deposit.cjs:", e);
    throw createError({
      statusCode: 500,
      statusMessage: "internal server error",
    });
  }

  const { buildDepositTransactions } = mod;

  try {
    const result = await buildDepositTransactions({ userPubkey, amount, mint });
    return result;
  } catch (err) {
    // 将内部错误映射为 h3 createError 以便 Nuxt 返回正确 statusCode
    const statusCode = err.statusCode || 500;
    throw createError({
      statusCode,
      statusMessage: err.message || "internal error",
    });
  }
});

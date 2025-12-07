export default defineEventHandler(async (event) => {
  const { queryTx } = require("../../solana/queryTx.cjs");

  const body = await readBody(event);
  const { signature, mint } = body || {};

  if (!signature || !mint) {
    return { status: "error", message: "missing params" };
  }

  const result = await queryTx(signature, mint);

  return {
    status: "success",
    data: result,
  };
});

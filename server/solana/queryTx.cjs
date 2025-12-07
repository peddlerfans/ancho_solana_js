const { Connection } = require("@solana/web3.js");

const RPC =
  process.env.SOLANA_RPC ||
  "https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb";

const connection = new Connection(RPC, "finalized");

async function queryTx(signature, mint) {
  const tx = await connection.getTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || !tx.meta) return null;

  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];

  let delta = 0;

  for (const p of post) {
    if (p.mint !== mint) continue;

    const before = pre.find(
      (b) =>
        b.accountIndex === p.accountIndex &&
        b.mint === mint
    );

    const preAmt = before?.uiTokenAmount?.uiAmount ?? 0;
    const postAmt = p?.uiTokenAmount?.uiAmount ?? 0;

    delta += postAmt - preAmt;
  }

  return {
    slot: tx.slot,
    err: tx.meta.err,
    delta,
  };
}

module.exports = { queryTx };

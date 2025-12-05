import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'
import bs58 from 'bs58'

const DEFAULT_RPC = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'
const DEFAULT_TOKEN = 'FP2i79n4Ar29GRRNCoeBfcwHzwpb5i11qW3oBh5QxgmS'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tokenAddress = (body?.tokenAddress || DEFAULT_TOKEN).trim()
  const privateKeys = Array.isArray(body?.privateKeys) ? body.privateKeys : []

  if (!tokenAddress) {
    throw createError({ statusCode: 400, statusMessage: '缺少代币地址' })
  }
  if (!privateKeys.length) {
    throw createError({ statusCode: 400, statusMessage: '请提供至少一个私钥' })
  }

  try {
    const connection = new Connection(DEFAULT_RPC)
    const mintPublicKey = new PublicKey(tokenAddress)

    let tokenDecimals = 0
    try {
      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey)
      if (mintInfo.value && mintInfo.value.data.parsed) {
        tokenDecimals = mintInfo.value.data.parsed.info.decimals
      }
    } catch (e) {
      // ignore decimals fetch errors; default to 0
    }

    const results = []

    for (let i = 0; i < privateKeys.length; i++) {
      const keyStr = (privateKeys[i] || '').trim()
      if (!keyStr) {
        results.push({
          index: i + 1,
          address: '缺失私钥',
          sol: '-',
          token: '-',
          error: '私钥为空',
        })
        continue
      }

      try {
        const keypair = Keypair.fromSecretKey(bs58.decode(keyStr))
        const solBalance = await connection.getBalance(keypair.publicKey)

        let tokenBalance = 0
        try {
          const tokenAccount = await getAssociatedTokenAddress(mintPublicKey, keypair.publicKey)
          const accountInfo = await getAccount(connection, tokenAccount)
          tokenBalance = Number(accountInfo.amount) / Math.pow(10, tokenDecimals || 0)
        } catch (e) {
          // token account may not exist
        }

        results.push({
          index: i + 1,
          address: keypair.publicKey.toBase58(),
          sol: Number((solBalance / 1e9).toFixed(6)),
          token: tokenBalance,
        })
      } catch (err) {
        results.push({
          index: i + 1,
          address: '解析失败',
          sol: '-',
          token: '-',
          error: err?.message || '解析失败',
        })
      }
    }

    return { decimals: tokenDecimals, results }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || '查询失败',
    })
  }
})

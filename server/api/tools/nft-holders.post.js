import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

// const DEFAULT_RPC = 'https://solana-rpc.publicnode.com'
const DEFAULT_RPC = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'
const DEFAULT_TOKEN = 'D9VY7opNKZzwhkU5SwwNLDgM5Qab1eoSQUPrgoRSyFGt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tokenAddress = (body?.tokenAddress || DEFAULT_TOKEN).trim()

  if (!tokenAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少 NFT mint 地址',
    })
  }

  try {
    const connection = new Connection(DEFAULT_RPC)
    const mintPublicKey = new PublicKey(tokenAddress)
    const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mintPublicKey.toBase58() } },
      ],
    })

    const holders = {}
    accounts.forEach((account) => {
      const info = account.account.data.parsed.info
      const owner = info.owner
      const amount = parseFloat(info.tokenAmount.uiAmountString || 0)
      if (amount > 0) {
        holders[owner] = (holders[owner] || 0) + amount
      }
    })

    const list = Object.entries(holders).map(([owner, amount]) => ({ owner, amount }))
    list.sort((a, b) => b.amount - a.amount)

    return {
      holders: list,
      summary: {
        totalHolders: list.length,
        totalAmount: list.reduce((sum, item) => sum + item.amount, 0),
      },
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || '查询失败',
    })
  }
})

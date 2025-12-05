import { PublicKey, Connection } from '@solana/web3.js'
import { constants } from './_anchorClient'
import { Buffer as NodeBuffer } from 'buffer'

const { PROGRAM_ID, RPC_ENDPOINT } = constants

export default defineEventHandler(async () => {
  if (!globalThis.Buffer) globalThis.Buffer = NodeBuffer
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')

  try {
    // 读 config，拿到 token_mint 和 decimals
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID,
    )
    const configInfo = await connection.getAccountInfo(configPda)
    if (!configInfo || !configInfo.data) {
      throw new Error('config 账户不存在，请先 initialize')
    }

    const cfgData = Buffer.from(configInfo.data)
    let cfgOffset = 8 // discriminator
    cfgOffset += 32 // admin pubkey
    const mintPk = new PublicKey(cfgData.slice(cfgOffset, cfgOffset + 32))

    const mintInfo = await connection.getParsedAccountInfo(mintPk)
    const decimals =
      mintInfo?.value &&
      mintInfo.value.data &&
      mintInfo.value.data.parsed &&
      typeof mintInfo.value.data.parsed.info?.decimals === 'number'
        ? mintInfo.value.data.parsed.info.decimals
        : 0

    // 扫描该 program 下所有账户，过滤出 UserRecord
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID)
    const userRecords = []

    for (const { pubkey, account } of allAccounts) {
      const data = Buffer.from(account.data)
      // UserRecord: 8(discriminator) + 32(user pubkey) + 8(u64 total_deposited) = 48 字节
      if (data.length !== 48) continue

      let offset = 8
      const userPk = new PublicKey(data.slice(offset, offset + 32))
      offset += 32
      const totalBig = data.readBigUInt64LE(offset)
      const totalRaw = totalBig.toString()

      // 转成人类可读数量
      let uiTotal
      if (decimals === 0) {
        uiTotal = totalRaw
      } else {
        const rawStr = totalRaw
        let intPart
        let fracPart
        if (rawStr.length > decimals) {
          intPart = rawStr.slice(0, rawStr.length - decimals)
          fracPart = rawStr.slice(rawStr.length - decimals)
        } else {
          intPart = '0'
          fracPart = rawStr.padStart(decimals, '0')
        }
        uiTotal = `${intPart}.${fracPart}`.replace(/\.?0+$/, '') || '0'
      }

      userRecords.push({
        pda: pubkey.toBase58(),
        user: userPk.toBase58(),
        total: totalRaw,
        uiTotal,
      })
    }

    // 按存入总额从大到小排序，便于查看
    // BigInt 运算不能直接返回给 sort（会触发 BigInt -> number 转换报错）
    userRecords.sort((a, b) => {
      const ba = BigInt(a.total)
      const bb = BigInt(b.total)
      if (bb > ba) return 1
      if (bb < ba) return -1
      return 0
    })

    return {
      mint: mintPk.toBase58(),
      decimals,
      count: userRecords.length,
      users: userRecords,
    }
  } catch (e) {
    console.error('[api/admin/get-users-deposits] error', e)
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'get_users_deposits 失败',
    })
  }
})

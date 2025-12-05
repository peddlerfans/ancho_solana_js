import { PublicKey, Connection } from '@solana/web3.js'
import { constants } from './_anchorClient'
import { Buffer as NodeBuffer } from 'buffer'

const { PROGRAM_ID, RPC_ENDPOINT } = constants

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userStr = query.user

  if (!userStr || typeof userStr !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少 user 参数',
    })
  }

  if (!globalThis.Buffer) {
    globalThis.Buffer = NodeBuffer
  }

  const user = new PublicKey(userStr)
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')

  const [userRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_record'), user.toBuffer()],
    PROGRAM_ID,
  )

  try {
    const info = await connection.getAccountInfo(userRecordPda)
    if (!info || !info.data) {
      // 用户未存款，视为 0
      return { total: 0 }
    }

    const data = Buffer.from(info.data)
    let offset = 8 // 跳过 discriminator

    // 跳过 user Pubkey（32 字节）
    offset += 32

    // 读取 total_deposited: u64（最小单位）
    const totalBig = data.readBigUInt64LE(offset)
    const totalRaw = totalBig.toString()

    // 从 config 账户读取 token_mint，再查询 mint 的 decimals
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID,
    )
    const configInfo = await connection.getAccountInfo(configPda)

    let decimals = 0
    if (configInfo && configInfo.data) {
      const cfg = Buffer.from(configInfo.data)
      let cfgOffset = 8 // skip discriminator
      // admin pubkey
      cfgOffset += 32
      // token_mint pubkey
      const mintPk = new PublicKey(cfg.slice(cfgOffset, cfgOffset + 32))
      const mintInfo = await connection.getParsedAccountInfo(mintPk)
      decimals =
        mintInfo?.value &&
        mintInfo.value.data &&
        mintInfo.value.data.parsed &&
        typeof mintInfo.value.data.parsed.info?.decimals === 'number'
          ? mintInfo.value.data.parsed.info.decimals
          : 0
    }

    // 按 decimals 转成人类可读字符串
    const rawStr = totalRaw
    if (decimals === 0) {
      return { total: rawStr, uiTotal: rawStr, decimals }
    }

    let intPart
    let fracPart
    if (rawStr.length > decimals) {
      intPart = rawStr.slice(0, rawStr.length - decimals)
      fracPart = rawStr.slice(rawStr.length - decimals)
    } else {
      intPart = '0'
      fracPart = rawStr.padStart(decimals, '0')
    }
    let uiStr = `${intPart}.${fracPart}`.replace(/\.?0+$/, '')
    if (uiStr === '') uiStr = '0'

    return { total: rawStr, uiTotal: uiStr, decimals }
  } catch (e) {
    const msg = e?.message || ''
    throw createError({
      statusCode: 500,
      statusMessage: msg || '查询失败',
    })
  }
})

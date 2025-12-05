import { PublicKey } from '@solana/web3.js'
import { Buffer as NodeBuffer } from 'buffer'
import { constants } from './_anchorClient'

const { PROGRAM_ID, RPC_ENDPOINT } = constants

export default defineEventHandler(async () => {
  if (!globalThis.Buffer) globalThis.Buffer = NodeBuffer

  try {
    const connection = new (await import('@solana/web3.js')).Connection(RPC_ENDPOINT, 'confirmed')
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID,
    )

    const info = await connection.getAccountInfo(configPda)
    if (!info || !info.data) {
      throw new Error('config 账户不存在，请先 initialize')
    }

    // 解析 account 数据：8字节 discriminator + fields
    const data = Buffer.from(info.data)
    let offset = 8 // skip discriminator

    const readPubkey = () => {
      const pk = new PublicKey(data.slice(offset, offset + 32))
      offset += 32
      return pk.toBase58()
    }
    const admin = readPubkey()
    const tokenMint = readPubkey()

    // recipients vec<Pubkey>
    const recLen = data.readUInt32LE(offset); offset += 4
    const recipients = []
    for (let i = 0; i < recLen; i++) {
      recipients.push(readPubkey())
    }

    // percentages vec<u16>
    const pctLen = data.readUInt32LE(offset); offset += 4
    const percentages = []
    for (let i = 0; i < pctLen; i++) {
      percentages.push(data.readUInt16LE(offset))
      offset += 2
    }

    const recipientCount = data.readUInt8(offset); offset += 1
    const isPaused = data.readUInt8(offset) === 1

    return {
      admin,
      token_mint: tokenMint,
      recipients,
      percentages,
      recipient_count: recipientCount,
      is_paused: isPaused,
      account: configPda.toBase58(),
    }
  } catch (e) {
    console.error('[api/admin/get-recipients-config] error', e)
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'get_recipients_config 失败',
    })
  }
})

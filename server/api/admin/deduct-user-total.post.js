import { PublicKey } from '@solana/web3.js'
import { getAdminProgram, constants } from './_anchorClient'
import * as anchor from '@coral-xyz/anchor'
import BN from 'bn.js'

const { PROGRAM_ID } = constants

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { adminSecret, targetUser, amount } = body || {}

  if (!targetUser || (typeof amount !== 'number' && typeof amount !== 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少 targetUser 或 amount',
    })
  }

  const { program, adminKeypair } = getAdminProgram(adminSecret)

  const userPk = new PublicKey(targetUser)
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID,
  )
  const [userRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_record'), userPk.toBuffer()],
    PROGRAM_ID,
  )

  // 从 config 中读出 token_mint，然后查 decimals
  const configInfo = await program.provider.connection.getAccountInfo(configPda)
  if (!configInfo || !configInfo.data) {
    throw createError({
      statusCode: 500,
      statusMessage: 'config 账户不存在，无法扣减',
    })
  }
  const cfgData = Buffer.from(configInfo.data)
  let cfgOffset = 8 // discriminator
  cfgOffset += 32 // admin
  const mintPk = new PublicKey(cfgData.slice(cfgOffset, cfgOffset + 32))
  const mintInfo = await program.provider.connection.getParsedAccountInfo(mintPk)
  const decimals =
    mintInfo?.value &&
    mintInfo.value.data &&
    mintInfo.value.data.parsed &&
    typeof mintInfo.value.data.parsed.info?.decimals === 'number'
      ? mintInfo.value.data.parsed.info.decimals
      : 0

  // 将实际数量字符串转换为最小单位 BN
  const uiAmountStr = String(amount).trim()
  if (!/^\d+(\.\d+)?$/.test(uiAmountStr)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'amount 必须是非负数字，可带小数',
    })
  }
  const [intPart, fracRaw = ''] = uiAmountStr.split('.')
  const fracPart = fracRaw.slice(0, decimals)
  const fracPadded = fracPart.padEnd(decimals, '0')
  const rawStr = (intPart + fracPadded).replace(/^0+/, '') || '0'
  const amountBn = new BN(rawStr)
  if (amountBn.lte(new BN(0))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'amount 必须大于 0',
    })
  }

  let ix = await program.methods
    .deductUserTotal(amountBn)
    .accounts({
      config: configPda,
      admin: adminKeypair.publicKey,
      userRecord: userRecordPda,
      targetUser: userPk,
    })
    .instruction()

  // config 可写；admin signer；userRecord 可写
  ix = new anchor.web3.TransactionInstruction({
    ...ix,
    keys: ix.keys.map((k) => {
      if (k.pubkey.equals(configPda)) {
        return { ...k, isWritable: true }
      }
      if (k.pubkey.equals(adminKeypair.publicKey)) {
        return { ...k, isSigner: true }
      }
      if (k.pubkey.equals(userRecordPda)) {
        return { ...k, isWritable: true }
      }
      return k
    }),
  })

  const tx = new anchor.web3.Transaction().add(ix)
  tx.feePayer = adminKeypair.publicKey
  tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash
  tx.sign(adminKeypair)
  const sig = await program.provider.sendAndConfirm(tx, [adminKeypair])

  return { signature: sig }
})

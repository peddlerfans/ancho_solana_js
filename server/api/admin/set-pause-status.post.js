import { PublicKey } from '@solana/web3.js'
import { getAdminProgram, constants } from './_anchorClient'
import * as anchor from '@coral-xyz/anchor'

const { PROGRAM_ID } = constants

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { adminSecret, isPaused } = body || {}

  if (typeof isPaused !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isPaused 必须是布尔值',
    })
  }

  const { program, adminKeypair } = getAdminProgram(adminSecret)

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID,
  )

  let ix = await program.methods
    .setPauseStatus(isPaused)
    .accounts({
      config: configPda,
      admin: adminKeypair.publicKey,
    })
    .instruction()

  // config 可写，admin 签名
  ix = new anchor.web3.TransactionInstruction({
    ...ix,
    keys: ix.keys.map((k) => {
      if (k.pubkey.equals(configPda)) {
        return { ...k, isWritable: true }
      }
      if (k.pubkey.equals(adminKeypair.publicKey)) {
        return { ...k, isSigner: true }
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

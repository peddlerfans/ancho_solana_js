import { PublicKey } from '@solana/web3.js'
import { getAdminProgram, constants } from './_anchorClient'
import * as anchor from '@coral-xyz/anchor'

const { PROGRAM_ID } = constants

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { adminSecret, recipients, percentages } = body || {}

  if (!Array.isArray(recipients) || !Array.isArray(percentages)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'recipients 和 percentages 必须是数组',
    })
  }

  const { program, adminKeypair } = getAdminProgram(adminSecret)

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID,
  )

  const recipientPks = recipients.map((r) => new PublicKey(r))
  const pctNumbers = percentages.map((n) => Number(n))

  let ix = await program.methods
    .setRecipients(recipientPks, pctNumbers)
    .accounts({
      config: configPda,
      admin: adminKeypair.publicKey,
    })
    .instruction()

  // config 可写；admin signer
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

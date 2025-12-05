import { PublicKey, SystemProgram } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { getAdminProgram, constants } from './_anchorClient'
import bs58 from 'bs58'

const { PROGRAM_ID } = constants

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { adminSecret, tokenMint } = body || {}

  if (!tokenMint) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少 tokenMint',
    })
  }

  // 校验 mint 是否是合法
  try {
    bs58.decode(tokenMint)
  } catch (e) {
    throw createError({
      statusCode: 400,
      statusMessage: 'tokenMint 不是合法的 Base58 公钥',
    })
  }

  try {
    const { program, adminKeypair } = getAdminProgram(adminSecret)

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID,
    )

    // 如果 config 已存在且不归本程序所有，提前报错提示
    const existing = await program.provider.connection.getAccountInfo(configPda)
    if (existing) {
      if (!existing.owner.equals(PROGRAM_ID)) {
        throw new Error(`config PDA 已存在且owner为 ${existing.owner.toBase58()}`)
      } else {
        throw new Error('config PDA 已存在，不可重复 initialize')
      }
    }

    let ix = await program.methods
      .initialize(new PublicKey(tokenMint))
      .accounts({
        config: configPda,
        admin: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction()

  // config 可写；admin 可写 + signer
    ix = new anchor.web3.TransactionInstruction({
      ...ix,
      keys: ix.keys.map((k) => {
        if (k.pubkey.equals(configPda)) {
          return { ...k, isWritable: true }
        }
        if (k.pubkey.equals(adminKeypair.publicKey)) {
          return { ...k, isWritable: true, isSigner: true }
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
  } catch (e) {
    console.error('[api/admin/initialize] error', e?.message, e?.stack)
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'initialize 失败',
    })
  }
})

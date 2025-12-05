import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import * as anchor from '@coral-xyz/anchor'
import BN from 'bn.js'
import { Buffer as NodeBuffer } from 'buffer'
import { constants, NORMALIZED_IDL } from '../admin/_anchorClient'

const { PROGRAM_ID, RPC_ENDPOINT, TOKEN_PROGRAM_ID, SystemProgram } = constants
const DEFAULT_MINT = 'FP2i79n4Ar29GRRNCoeBfcwHzwpb5i11qW3oBh5QxgmS'

const parseAmountToRawBn = async (connection, mint, uiAmountStr) => {
  if (!/^\d+(\.\d+)?$/.test(uiAmountStr)) {
    throw createError({ statusCode: 400, statusMessage: 'amount 必须是非负数字，可带小数，例如 100 或 0.5' })
  }
  const mintInfo = await connection.getParsedAccountInfo(mint)
  const decimals =
    mintInfo?.value &&
    mintInfo.value.data &&
    mintInfo.value.data.parsed &&
    mintInfo.value.data.parsed.info &&
    typeof mintInfo.value.data.parsed.info.decimals === 'number'
      ? mintInfo.value.data.parsed.info.decimals
      : 0

  const [intPart, fracPartRaw = ''] = String(uiAmountStr).trim().split('.')
  const fracPart = fracPartRaw.slice(0, decimals)
  const fracPadded = fracPart.padEnd(decimals, '0')
  const rawStr = (intPart + fracPadded).replace(/^0+/, '') || '0'
  const rawBn = new BN(rawStr)
  if (rawBn.lte(new BN(0))) {
    throw createError({ statusCode: 400, statusMessage: 'amount 转换后必须大于 0' })
  }
  return { rawBn, decimals }
}

const readConfig = async (connection, mint) => {
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)
  const configInfo = await connection.getAccountInfo(configPda)
  if (!configInfo || !configInfo.data) {
    throw createError({ statusCode: 400, statusMessage: 'config 账户不存在，请先由管理员 initialize' })
  }

  const data = Buffer.from(configInfo.data)
  let offset = 8 // discriminator

  const readPubkey = () => {
    const pk = new PublicKey(data.slice(offset, offset + 32))
    offset += 32
    return pk
  }

  const _adminPk = readPubkey()
  const tokenMintPk = readPubkey()

  if (!tokenMintPk.equals(mint)) {
    throw createError({
      statusCode: 400,
      statusMessage: `链上配置的 token_mint(${tokenMintPk.toBase58()}) 与前端使用的 mint(${mint.toBase58()}) 不一致`,
    })
  }

  const recLen = data.readUInt32LE(offset); offset += 4
  const recipientPks = []
  for (let i = 0; i < recLen; i++) {
    recipientPks.push(readPubkey())
  }

  const pctLen = data.readUInt32LE(offset); offset += 4
  const percentages = []
  for (let i = 0; i < pctLen; i++) {
    percentages.push(data.readUInt16LE(offset))
    offset += 2
  }

  const recipientCount = data.readUInt8(offset); offset += 1
  const isPaused = data.readUInt8(offset) === 1

  const effectiveCount = recipientCount > 0 ? recipientCount : recipientPks.length
  const effectiveRecipients = recipientPks.slice(0, effectiveCount)

  if (isPaused) {
    throw createError({ statusCode: 400, statusMessage: '合约当前处于暂停状态，无法存入' })
  }
  if (effectiveRecipients.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '未配置接收者，无法分发' })
  }
  if (effectiveRecipients.length !== recipientCount) {
    throw createError({ statusCode: 400, statusMessage: '配置接收者数量不一致，请管理员重新设置' })
  }

  return {
    configPda,
    recipients: effectiveRecipients,
    recipientCount,
    percentages,
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userPubkey, amount } = body || {}

  if (!globalThis.Buffer) globalThis.Buffer = NodeBuffer

  if (!userPubkey) {
    throw createError({ statusCode: 400, statusMessage: '缺少 userPubkey' })
  }

  let userPk
  try {
    userPk = new PublicKey(String(userPubkey).trim())
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: 'userPubkey 无效' })
  }

  const mintStr = useRuntimeConfig().public?.tokenMint || DEFAULT_MINT
  let mint
  try {
    mint = new PublicKey(mintStr)
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: `tokenMint 无效: ${mintStr}` })
  }

  const connection = new anchor.web3.Connection(RPC_ENDPOINT, 'confirmed')
  const wallet = {
    publicKey: userPk,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  }
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const program = new anchor.Program(NORMALIZED_IDL, provider)

  const { rawBn, decimals } = await parseAmountToRawBn(connection, mint, amount)
  const { configPda, recipients, recipientCount } = await readConfig(connection, mint)

  const [userRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_record'), userPk.toBuffer()],
    PROGRAM_ID,
  )
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), configPda.toBuffer()],
    PROGRAM_ID,
  )

  const userAta = getAssociatedTokenAddressSync(mint, userPk)
  const ataInstructions = []
  let userAtaInfo = await connection.getAccountInfo(userAta)
  if (!userAtaInfo) {
    ataInstructions.push(
      createAssociatedTokenAccountInstruction(
        userPk, // payer
        userAta,
        userPk,
        mint,
      )
    )
  }

  const remainingAccounts = []
  for (const recipient of recipients) {
    const ata = getAssociatedTokenAddressSync(mint, recipient)
    const info = await connection.getAccountInfo(ata)
    if (!info) {
      ataInstructions.push(
        createAssociatedTokenAccountInstruction(
          userPk,
          ata,
          recipient,
          mint,
        )
      )
    }
    remainingAccounts.push({
      pubkey: ata,
      isWritable: true,
      isSigner: false,
    })
  }

  let ix = await program.methods
    .depositAndDistribute(rawBn)
    .accounts({
      config: configPda,
      mint,
      userRecord: userRecordPda,
      user: userPk,
      userTokenAccount: userAta,
      vaultTokenAccount: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  ix = new anchor.web3.TransactionInstruction({
    ...ix,
    keys: ix.keys.map((k) => {
      if (k.pubkey.equals(userPk)) {
        return { ...k, isSigner: true }
      }
      if (
        k.pubkey.equals(userRecordPda) ||
        k.pubkey.equals(userAta) ||
        k.pubkey.equals(vaultPda) ||
        k.pubkey.equals(configPda)
      ) {
        return { ...k, isWritable: true }
      }
      return k
    }),
  })

  const buildUnsignedTx = async (instructions, withHighCu = false) => {
    const tx = new anchor.web3.Transaction()
    if (withHighCu) {
      tx.add(anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    }
    instructions.forEach((ins) => tx.add(ins))
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.feePayer = userPk
    tx.recentBlockhash = blockhash
    return { tx, blockhash, lastValidBlockHeight }
  }

  const txItems = []
  const CHUNK_SIZE = 4
  for (let i = 0; i < ataInstructions.length; i += CHUNK_SIZE) {
    const chunk = ataInstructions.slice(i, i + CHUNK_SIZE)
    if (chunk.length === 0) continue
    const built = await buildUnsignedTx(chunk, false)
    txItems.push({
      label: 'create-atas',
      ...built,
    })
  }

  const needHighCu = recipientCount >= 10
  const mainTx = await buildUnsignedTx([ix], needHighCu)
  txItems.push({
    label: 'deposit-and-distribute',
    ...mainTx,
  })

  return {
    transactions: txItems.map(({ tx, blockhash, lastValidBlockHeight, label }) => ({
      txBase64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
      blockhash,
      lastValidBlockHeight,
      label,
    })),
    meta: {
      mint: mint.toBase58(),
      user: userPk.toBase58(),
      userAta: userAta.toBase58(),
      recipients: recipients.map((r) => r.toBase58()),
      recipientCount,
      amountRaw: rawBn.toString(),
      decimals,
    },
  }
})

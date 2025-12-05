import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token'
import bs58 from 'bs58'

const DEFAULT_RPC = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'
const DEFAULT_TOKEN = 'FP2i79n4Ar29GRRNCoeBfcwHzwpb5i11qW3oBh5QxgmS'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const fromPrivateKey = (body?.fromPrivateKey || '').trim()
  const toAddress = (body?.toAddress || '').trim()
  const tokenAddress = (body?.tokenAddress || DEFAULT_TOKEN).trim()
  const amountRaw = body?.amount

  if (!fromPrivateKey || !toAddress || !tokenAddress) {
    throw createError({ statusCode: 400, statusMessage: '缺少必要参数' })
  }

  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: '转账数量需大于 0' })
  }

  try {
    const connection = new Connection(DEFAULT_RPC)
    const mintPublicKey = new PublicKey(tokenAddress)
    const toPubkey = new PublicKey(toAddress)
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey))

    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey)
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals ?? 0

    const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, fromKeypair.publicKey)
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      mintPublicKey,
      toPubkey
    )

    const amountInSmallest = BigInt(Math.round(amount * Math.pow(10, decimals)))

    const tx = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount.address,
        fromKeypair.publicKey,
        amountInSmallest
      )
    )

    const signature = await connection.sendTransaction(tx, [fromKeypair])
    await connection.confirmTransaction(signature, 'confirmed')

    return {
      signature,
      from: fromKeypair.publicKey.toBase58(),
      to: toPubkey.toBase58(),
      decimals,
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || '转账失败',
    })
  }
})

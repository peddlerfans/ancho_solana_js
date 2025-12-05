import { Buffer as NodeBuffer } from 'buffer'
import { createHash } from 'crypto'

if (!globalThis.Buffer) {
  globalThis.Buffer = NodeBuffer
}

import * as anchor from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import bs58 from 'bs58'
import idlRaw from '../../idl.json'

const PROGRAM_ID = new PublicKey('D98rv6Qi7AxAh2fCsvGYH27XgC7DMWV8rYCkRooyNdv6')
// 使用 Helius Devnet RPC
const RPC_ENDPOINT = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

export const constants = {
  PROGRAM_ID,
  RPC_ENDPOINT,
  TOKEN_PROGRAM_ID,
  SystemProgram,
}

const buildNormalizedIdl = () => {
  const jsonString = JSON.stringify(idlRaw)
  const withPubkey = jsonString.replace(/"publicKey"/g, '"pubkey"')
  const parsed = JSON.parse(withPubkey)
  if (!parsed.address) {
    parsed.address = PROGRAM_ID.toBase58()
  }
  const camelToSnake = (s) =>
    s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  parsed.instructions = (parsed.instructions || []).map((ix) => {
    const hashName = ix.name?.includes('_') ? ix.name : camelToSnake(ix.name || '')
    if (!ix.discriminator) {
      const hash = createHash('sha256').update(`global:${hashName}`).digest()
      ix.discriminator = Array.from(Buffer.from(hash).subarray(0, 8))
    }
    ix.accounts = (ix.accounts || []).map((acc) => {
      return {
        name: acc.name,
        isMut: !!acc.isMut,
        isSigner: !!acc.isSigner,
      }
    })
    return ix
  })

  parsed.types = parsed.types || []
  const typeNames = new Set(parsed.types.map((t) => t.name))
  for (const acc of parsed.accounts || []) {
    if (!typeNames.has(acc.name)) {
      parsed.types.push({
        name: acc.name,
        type: acc.type,
      })
      typeNames.add(acc.name)
    }
  }

  parsed.events = []

  return parsed
}

const NORMALIZED_IDL = buildNormalizedIdl()

export function getAdminProgram(adminSecretBase58) {
  if (!globalThis.Buffer) {
    globalThis.Buffer = NodeBuffer
  }
  if (!adminSecretBase58) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少管理员私钥',
    })
  }

  let secretBytes
  try {
    secretBytes = bs58.decode(adminSecretBase58.trim())
  } catch (e) {
    throw createError({
      statusCode: 400,
      statusMessage: '管理员私钥格式不正确（需要 Base58）',
    })
  }

  const adminKeypair = Keypair.fromSecretKey(secretBytes)
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')
  const wallet = new anchor.Wallet(adminKeypair)
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })

  const program = new anchor.Program(NORMALIZED_IDL, provider)

  return { program, provider, adminKeypair, connection }
}

export { NORMALIZED_IDL }
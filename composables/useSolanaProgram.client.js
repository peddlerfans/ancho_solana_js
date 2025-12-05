import { ref } from 'vue'
import { Buffer } from 'buffer'
import * as anchor from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram, Keypair } from '@solana/web3.js'
import idlRaw from '~~/server/idl.json'
import bs58 from 'bs58'

// Anchor/Borsh 依赖全局 Buffer
if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

const PROGRAM_ID = new PublicKey('D98rv6Qi7AxAh2fCsvGYH27XgC7DMWV8rYCkRooyNdv6')
const RPC_ENDPOINT = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

// Anchor 0.30 JS 期望 IDL:
// - 含 address 字段
// - 公钥类型为 "pubkey"
const buildNormalizedIdl = () => {
  const json = JSON.stringify(idlRaw)
  const withPubkey = json.replace(/"publicKey"/g, '"pubkey"')
  const parsed = JSON.parse(withPubkey)
  if (!parsed.address) {
    parsed.address = PROGRAM_ID.toBase58()
  }
  return parsed
}

const NORMALIZED_IDL = buildNormalizedIdl()

const toPubkey = (val) => {
  if (!val) return null
  try {
    const asString = typeof val.toBase58 === 'function' ? val.toBase58() : val.toString()
    return new PublicKey(asString)
  } catch (e) {
    return null
  }
}

const pickProvider = () => {
  if (typeof window === 'undefined') return null
  // 确保 Buffer 在浏览器可用，Anchor/Borsh 依赖 Buffer
  if (!window.Buffer) {
    window.Buffer = Buffer
  }
  if (window?.phantom?.solana?.isPhantom) return window.phantom.solana
  return null
}

export function useSolanaProgram() {
  const walletPublicKey = ref(null)
  const loading = ref(false)
  const error = ref('')

  const getClient = async () => {
    if (typeof window === 'undefined') {
      throw new Error('仅在浏览器中可连接钱包')
    }
    const walletProvider = pickProvider()
    if (!walletProvider) {
      throw new Error('未检测到可用的 Solana 钱包（建议使用 Phantom）')
    }

    // 若还未连接，优先尝试 connect
    if (!walletProvider.publicKey && walletProvider.connect) {
      try {
        const res = await walletProvider.connect()
        const pk = toPubkey(res?.publicKey || walletProvider.publicKey)
        walletPublicKey.value = pk ? pk.toBase58() : walletPublicKey.value
      } catch (e) {
        // 保持向上抛出
      }
    }

    const providerPkRaw = walletProvider.publicKey
    let pk = toPubkey(providerPkRaw) || toPubkey(walletPublicKey.value)
    if (!pk || !pk._bn) {
      const msg = pk
        ? '钱包公钥格式异常（缺少 _bn），请更换 Phantom 等标准 Solana 钱包'
        : '钱包未连接或公钥无效，请先点击“连接钱包”'
      console.error('[useSolanaProgram] Invalid wallet public key', {
        providerPkRaw,
        providerPkKeys: providerPkRaw ? Object.keys(providerPkRaw) : null,
        providerKeys: Object.keys(walletProvider || {}),
        walletPublicKey: walletPublicKey.value,
        pkPreview: pk?.toString?.(),
      })
      throw new Error(msg)
    }
    // 调试提示：可在 DevTools 查看当前使用的钱包与公钥
    console.debug('[useSolanaProgram] provider detected', {
      providerKeys: Object.keys(walletProvider || {}),
      walletPk: pk.toBase58(),
    })

    const connection = new Connection(RPC_ENDPOINT, 'confirmed')
    const wallet = {
      publicKey: pk,
      signTransaction: walletProvider.signTransaction?.bind(walletProvider),
      signAllTransactions: walletProvider.signAllTransactions?.bind(walletProvider),
      sendTransaction: walletProvider.sendTransaction?.bind(walletProvider),
    }
    const anchorProvider = new anchor.AnchorProvider(connection, wallet, {
      preflightCommitment: 'confirmed',
    })
    // 前端当前仅需 connection + provider 进行签名发送，跳过 Program 初始化以避免无用报错
    return { connection, anchorProvider, walletProvider, anchor }
  }

  const connectWallet = async () => {
    try {
      error.value = ''
      if (typeof window === 'undefined') {
        throw new Error('仅在浏览器中可连接钱包')
      }
      const provider = pickProvider()
      if (!provider) {
        throw new Error('未检测到钱包，请安装 Phantom 等钱包')
      }
      const res = await provider.connect()
      const pk = toPubkey(res?.publicKey || provider.publicKey)
      walletPublicKey.value = pk ? pk.toBase58() : null
      return walletPublicKey.value
    } catch (e) {
      error.value = e.message || '连接钱包失败'
      throw e
    }
  }

  const getPdas = (userPubkeyStr) => {
    const userPk = new PublicKey(userPubkeyStr)
    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID
    )
    const [userRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_record'), userPk.toBuffer()],
      PROGRAM_ID
    )
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), config.toBuffer()],
      PROGRAM_ID
    )
    return { config, userRecord, vaultTokenAccount }
  }

  const generateKeypairs = (count) => {
    const list = []
    for (let i = 0; i < count; i += 1) {
      const kp = Keypair.generate()
      list.push({
        index: i + 1,
        publicKey: kp.publicKey.toBase58(),
        secretKeyBase58: bs58.encode(kp.secretKey),
      })
    }
    return list
  }

  return {
    PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    SystemProgram,
    walletPublicKey,
    loading,
    error,
    connectWallet,
    getClient,
    getPdas,
    generateKeypairs,
  }
}

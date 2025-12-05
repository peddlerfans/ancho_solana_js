<template>
  <div class="container">
    <header class="mb-8">
      <h1 class="text-3xl font-semibold text-emerald-500 mb-2">用户端</h1>
      <p class="subtitle">钱包签名：后端构建交易，前端用钱包签名交易并发送 <code>deposit_and_distribute</code></p>
    </header>

    <div class="card mb-6">
      <h2 class="section-title mb-3">存入并分发代币</h2>
      <div class="flex items-center gap-3 mb-4">
        <button class="btn" @click="onConnectWallet" :disabled="connectLoading">
          {{ connectLoading ? '连接中...' : '连接钱包' }}
        </button>
        <span v-if="walletPublicKey" class="text-sm text-slate-600">
          已连接：{{ shortPk(walletPublicKey) }}
        </span>
        <span v-else class="text-sm text-slate-500">
          未连接
        </span>
      </div>
      <p v-if="walletError" class="text-sm text-red-500 mb-3">{{ walletError }}</p>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="label">代币 Mint 地址</label>
          <input v-model="mint" class="input bg-slate-50" readonly>
        </div>
        <div>
          <label class="label">用户代币账户（自动推导）</label>
          <input
            :value="userTokenAccount"
            class="input bg-slate-50"
            readonly
            placeholder="请先连接钱包"
          >
        </div>
        <div>
          <label class="label">存入数量</label>
          <input
            v-model="amount"
            type="text"
            inputmode="decimal"
            class="input"
            placeholder=""
          >
        </div>
      </div>
      <button
        class="btn mt-4"
        @click="onDeposit"
        :disabled="loading"
      >
        {{ loading ? '交易发送中...' : '提交交易' }}
      </button>

      <div v-if="txSigs.length" class="mt-4 text-sm space-y-2">
        <div class="font-semibold mb-1">交易签名（devnet）：</div>
        <div v-for="item in txSigs" :key="item.signature" class="flex gap-2 items-center">
          <span class="text-slate-600">{{ item.label }}</span>
          <a
            class="text-emerald-600 underline break-all"
            :href="`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`"
            target="_blank"
            rel="noreferrer"
          >
            {{ item.signature }}
          </a>
        </div>
      </div>
      <p v-if="txError" class="mt-3 text-sm text-red-500">{{ txError }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Buffer } from 'buffer'
import { useSolanaProgram } from '~/composables/useSolanaProgram.client'

definePageMeta({
  ssr: false,
})

const loading = ref(false)
const connectLoading = ref(false)
const fixedMintPreset = useRuntimeConfig().public?.tokenMint || 'FP2i79n4Ar29GRRNCoeBfcwHzwpb5i11qW3oBh5QxgmS'
const mint = ref(fixedMintPreset)
const amount = ref('')
const txSigs = ref([])
const txError = ref('')
const { walletPublicKey, connectWallet, error: walletError, getClient } = useSolanaProgram()
const userTokenAccount = computed(() => {
  if (!walletPublicKey.value || !mint.value) return ''
  try {
    return getAssociatedTokenAddressSync(
      new PublicKey(mint.value),
      new PublicKey(walletPublicKey.value)
    ).toBase58()
  } catch (e) {
    return ''
  }
})

const shortPk = (pk) => pk.slice(0, 4) + '...' + pk.slice(-4)

const onConnectWallet = async () => {
  walletError.value = ''
  connectLoading.value = true
  try {
    await connectWallet()
  } catch (e) {
    walletError.value = e?.message || '连接钱包失败'
  } finally {
    connectLoading.value = false
  }
}

const onDeposit = async () => {
  txSigs.value = []
  txError.value = ''
  loading.value = true
  try {
    if (!walletPublicKey.value) {
      await onConnectWallet()
    }
    if (!walletPublicKey.value) {
      throw new Error('请先连接钱包')
    }
    if (!amount.value.trim()) {
      throw new Error('请填写存入数量')
    }
    const ata = userTokenAccount.value
    if (!ata) {
      throw new Error('无法推导用户代币账户，请检查钱包连接或 mint 配置')
    }

    const { connection, anchorProvider, walletProvider } = await getClient()
    const res = await $fetch('/api/user/deposit-build', {
      method: 'POST',
      body: {
        userPubkey: walletPublicKey.value,
        amount: amount.value.trim(),
      },
    })
    const txItems = res?.transactions || []
    if (!txItems.length) {
      throw new Error('后端未返回交易')
    }

    for (const [index, item] of txItems.entries()) {
      const raw = Buffer.from(item.txBase64, 'base64')
      const tx = Transaction.from(raw)
      tx.feePayer = new PublicKey(walletPublicKey.value)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
      tx.recentBlockhash = blockhash

      const signer = anchorProvider?.wallet || walletProvider
      if (!signer?.signTransaction) {
        throw new Error('当前钱包不支持 signTransaction')
      }
      const signed = await signer.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')

      txSigs.value.push({
        label: item.label || `交易${index + 1}`,
        signature: sig,
      })
    }
  } catch (e) {
    console.error(e)
    txError.value = e.message || '交易发送失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.container {
  @apply max-w-5xl mx-auto py-10 px-4;
}
.card {
  @apply bg-white shadow rounded-xl p-6 border border-slate-100;
}
.section-title {
  @apply text-xl font-semibold text-slate-800;
}
.subtitle {
  @apply text-slate-500;
}
.btn {
  @apply inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition;
}
.input {
  @apply w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400;
}
.label {
  @apply block text-xs font-medium text-slate-600 mb-1;
}
</style>

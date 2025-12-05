<template>
  <div class="container">
    <header class="mb-8">
      <h1 class="text-3xl font-semibold text-emerald-500 mb-2">管理员端 </h1>
      <p class="subtitle">
        管理 Config、接收者、暂停状态、管理员变更，以及紧急提取 / 记录维护
      </p>
    </header>

    <div class="card mb-6">
      <h2 class="section-title mb-3">管理员私钥（后端签名）</h2>
      <label class="label">管理员私钥（Base58）</label>
      <input
        v-model="adminSecret"
        type="password"
        autocomplete="off"
        class="input"
        placeholder="请输入私钥"
      />
      <p v-if="!adminSecret" class="mt-2 text-xs text-red-500">
        未填写 所有写操作会直接报错
      </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mb-6">
      <div class="card">
        <h2 class="section-title mb-3">初始化合约（initialize）</h2>
        <label class="label">代币 Mint 地址</label>
        <input v-model="initMint" class="input" placeholder="token_mint 公钥">
        <button class="btn mt-3" @click="onInitialize" :disabled="loading">
          调用
        </button>
      </div>

      <div class="card">
        <h2 class="section-title mb-3">设置接收者（set_recipients）</h2>
        <p class="subtitle text-xs mb-2">格式：pubkey,百分比（基点）</p>
        <textarea
          v-model="recipientsRaw"
          class="input min-h-[120px] font-mono text-xs"
          placeholder="例：&#10;Address1,556&#10;Address2,556&#10;...">
        </textarea>
        <button class="btn mt-3" @click="onSetRecipients" :disabled="loading">
          更新接收者
        </button>
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mb-6">
      <div class="card">
        <h2 class="section-title mb-3">暂停 / 恢复（set_pause_status）</h2>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="pauseStatus">
            <span>暂停合约（勾选为暂停）</span>
          </label>
        </div>
        <button class="btn mt-3" @click="onSetPause" :disabled="loading">
          提交
        </button>
      </div>

      <div class="card">
        <h2 class="section-title mb-3">更换管理员（transfer_admin）</h2>
        <label class="label">新管理员地址</label>
        <input v-model="newAdmin" class="input" placeholder="新管理员地址">
        <button class="btn mt-3" @click="onTransferAdmin" :disabled="loading">
          转移管理员权限
        </button>
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mb-6">
      <div class="card">
        <h2 class="section-title mb-3">查询接收者配置（get_recipients_config）</h2>
        <div class="space-y-3 mb-4">
          <button class="btn w-full" @click="onGetRecipients" :disabled="loading">
            get_recipients_config
          </button>
          <div v-if="recipientsConfig" class="mt-3 text-xs bg-slate-50 p-3 rounded border">
            <div class="font-semibold mb-1">当前接收者配置</div>
            <pre class="whitespace-pre-wrap break-all">{{ JSON.stringify(recipientsConfig, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title mb-3">查询所有用户存款（RPC 扫描）</h2>
        <p class="subtitle text-xs mb-2">
          查询全部，用户多时稍慢
        </p>
        <button class="btn" @click="onGetUsersDeposits" :disabled="loading">
          查询
        </button>
        <div v-if="usersDeposits" class="mt-3 text-xs bg-slate-50 p-3 rounded border">
          <pre class="whitespace-pre-wrap break-all">
{{ JSON.stringify(usersDeposits, null, 2) }}
          </pre>
        </div>
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mb-6">
      <div class="card">
        <h2 class="section-title mb-3">查询用户存入总额（get_user_total）</h2>
        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <label class="label">用户地址</label>
            <input v-model="queryUser" class="input" placeholder="用户地址">
          </div>
          <button class="btn" @click="onGetUserTotal" :disabled="loading || !queryUser">
            查询
          </button>
        </div>
        <div v-if="userTotal !== null" class="mt-3 text-sm">
          <div>用户累计存入（原始最小单位）：<span class="font-mono">{{ userTotal }}</span></div>
          <div v-if="userTotalUi !== null" class="mt-1">
            折合实际数量：<span class="font-mono">{{ userTotalUi }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title mb-3">扣减用户数量（deduct_user_total）</h2>
        <div class="space-y-4">
          <div>
            <label class="label">用户地址</label>
            <input v-model="deductUser" class="input" placeholder="用户地址">
            <label class="label mt-2">扣减金额</label>
            <input
              v-model="deductAmount"
              type="text"
              inputmode="decimal"
              class="input"
              placeholder="代币数量 可带小数"
            >
            <button class="btn mt-2" @click="onDeductUserTotal" :disabled="loading || !deductUser">
              调用
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lastTxSig || lastError" class="mt-6 text-sm">
      <div v-if="lastTxSig" class="mb-2">
        最近一次交易签名（devnet）：
        <a
          :href="`https://explorer.solana.com/tx/${lastTxSig}?cluster=devnet`"
          target="_blank"
          rel="noreferrer"
          class="text-emerald-600 underline break-all"
        >
          {{ lastTxSig }}
        </a>
      </div>
      <p v-if="lastError" class="text-red-500">错误：{{ lastError }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { PublicKey, SystemProgram } from '@solana/web3.js'

definePageMeta({
  ssr: false,
})

const adminSecret = ref('')
const loading = ref(false)
const error = ref('')

const initMint = ref('')
const recipientsRaw = ref('')
const pauseStatus = ref(false)
const newAdmin = ref('')
const queryUser = ref('')
const recipientsConfig = ref(null)
const userTotal = ref(null)
const userTotalUi = ref(null)
const deductUser = ref('')
const deductAmount = ref('')
const usersDeposits = ref(null)

const lastTxSig = ref('')
const lastError = ref('')

const shortPk = (pk) => pk.slice(0, 4) + '...' + pk.slice(-4)

const withTx = async (fn) => {
  lastTxSig.value = ''
  lastError.value = ''
  loading.value = true
  try {
    const sig = await fn()
    if (sig) lastTxSig.value = sig
  } catch (e) {
    console.error(e)
    lastError.value = e.message || '交易失败'
  } finally {
    loading.value = false
  }
}

const getConfigPda = () => {
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  )
  return config
}

const onInitialize = async () => {
  if (!adminSecret.value || !initMint.value) {
    lastError.value = '请填写管理员私钥和代币 Mint 地址'
    return
  }
  await withTx(async () => {
    const res = await $fetch('/api/admin/initialize', {
      method: 'POST',
      body: {
        adminSecret: adminSecret.value,
        tokenMint: initMint.value,
      },
    })
    return res.signature
  })
}

const onSetRecipients = async () => {
  if (!adminSecret.value || !recipientsRaw.value.trim()) {
    lastError.value = '请先填写管理员私钥和接收者配置'
    return
  }
  const lines = recipientsRaw.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const recipients = []
  const percentages = []
  for (const line of lines) {
    const [addr, pctStr] = line.split(',').map((x) => x.trim())
    if (!addr || !pctStr) continue
    recipients.push(new PublicKey(addr))
    percentages.push(Number(pctStr))
  }

  await withTx(async () => {
    const res = await $fetch('/api/admin/set-recipients', {
      method: 'POST',
      body: {
        adminSecret: adminSecret.value,
        recipients: recipients.map((pk) => pk.toBase58()),
        percentages,
      },
    })
    return res.signature
  })
}

const onSetPause = async () => {
  if (!adminSecret.value) {
    lastError.value = '请先填写管理员私钥'
    return
  }
  await withTx(async () => {
    const res = await $fetch('/api/admin/set-pause-status', {
      method: 'POST',
      body: {
        adminSecret: adminSecret.value,
        isPaused: pauseStatus.value,
      },
    })
    return res.signature
  })
}

const onTransferAdmin = async () => {
  if (!adminSecret.value || !newAdmin.value) {
    lastError.value = '请填写管理员私钥和新管理员地址'
    return
  }
  await withTx(async () => {
    const res = await $fetch('/api/admin/transfer-admin', {
      method: 'POST',
      body: {
        adminSecret: adminSecret.value,
        newAdmin: newAdmin.value,
      },
    })
    return res.signature
  })
}

const onGetUserTotal = async () => {
  if (!queryUser.value) return
  try {
    loading.value = true
    const res = await $fetch('/api/admin/get-user-total', {
      method: 'GET',
      query: { user: queryUser.value },
    })
    userTotal.value = res.total
    userTotalUi.value = res.uiTotal
  } catch (e) {
    console.error(e)
    lastError.value = e.message || '查询失败'
  } finally {
    loading.value = false
  }
}

const onGetRecipients = async () => {
  try {
    loading.value = true
    const res = await $fetch('/api/admin/get-recipients-config', {
      method: 'GET',
    })
    recipientsConfig.value = res
  } catch (e) {
    console.error(e)
    lastError.value = e.message || '查询失败'
  } finally {
    loading.value = false
  }
}

const onDeductUserTotal = async () => {
  if (!adminSecret.value || !deductUser.value || !deductAmount.value.trim()) {
    lastError.value = '请填写管理员私钥、目标用户地址和扣减金额'
    return
  }
  await withTx(async () => {
    const res = await $fetch('/api/admin/deduct-user-total', {
      method: 'POST',
      body: {
        adminSecret: adminSecret.value,
        targetUser: deductUser.value,
        amount: deductAmount.value.trim(),
      },
    })
    return res.signature
  })
}

const onGetUsersDeposits = async () => {
  try {
    loading.value = true
    const res = await $fetch('/api/admin/get-users-deposits', {
      method: 'GET',
    })
    usersDeposits.value = res
  } catch (e) {
    console.error(e)
    lastError.value = e.message || '查询失败'
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
.container {
  @apply max-w-6xl mx-auto py-10 px-4;
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

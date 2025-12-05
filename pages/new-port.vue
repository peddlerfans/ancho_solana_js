<template>
  <div class="container">
    <header class="mb-8">
      <h1 class="text-3xl font-semibold text-emerald-500 mb-2">新增端口</h1>
    </header>

    <div class="card mb-6 space-y-4">
      <h2 class="section-title">查询 NFT 持有人列表</h2>

      <div>
        <label class="label">NFT Mint 地址</label>
        <input v-model="holderTokenAddress" class="input" placeholder="输入 NFT mint 地址">
      </div>

      <div class="flex gap-3">
        <button class="btn" @click="fetchHolders" :disabled="holdersLoading">
          {{ holdersLoading ? '查询中...' : '查询持有人列表' }}
        </button>
      </div>

      <p v-if="holdersError" class="text-sm text-red-500">{{ holdersError }}</p>

      <div v-if="holdersResult.length" class="text-sm space-y-2">
        <div class="flex gap-4 text-slate-600">
          <span>总人数：<span class="font-semibold text-slate-800">{{ holdersSummary.totalHolders }}</span></span>
          <span>总持有量：<span class="font-semibold text-slate-800">{{ holdersSummary.totalAmount }}</span></span>
        </div>
        <div class="overflow-auto rounded border border-slate-100">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-3 py-2">地址</th>
                <th class="px-3 py-2 w-32">持有量</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in holdersResult" :key="item.owner" class="border-t">
                <td class="px-3 py-2 font-mono text-xs break-all">{{ item.owner }}</td>
                <td class="px-3 py-2">{{ item.amount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card space-y-4">
      <h2 class="section-title">私钥列表余额 / 转账</h2>

      <div>
        <label class="label">代币地址</label>
        <input v-model="batchTokenAddress" class="input" placeholder="SPL Token Mint 地址">
      </div>

      <div>
        <label class="label">私钥列表（每行一个 Base58 私钥）</label>
        <textarea
          v-model="privateKeysRaw"
          class="input w-full min-h-[280px] font-mono text-sm leading-6"
          placeholder="每行一个私钥"
        ></textarea>
      </div>

      <div class="flex gap-3 flex-wrap">
        <button class="btn" @click="fetchBalances" :disabled="balancesLoading">
          {{ balancesLoading ? '查询中...' : '查询余额' }}
        </button>
      </div>

      <p v-if="balancesError" class="text-sm text-red-500">{{ balancesError }}</p>

      <div v-if="balancesResult.length" class="text-sm space-y-2">
        <div class="flex gap-4 text-slate-600 flex-wrap">
          <span>钱包数量：<span class="font-semibold text-slate-800">{{ balancesResult.length }}</span></span>
          <span>代币精度：<span class="font-semibold text-slate-800">{{ tokenDecimals }}</span></span>
        </div>
        <div class="overflow-auto rounded border border-slate-100">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-3 py-2 w-16">序号</th>
                <th class="px-3 py-2">地址</th>
                <th class="px-3 py-2 w-28">SOL</th>
                <th class="px-3 py-2 w-36">代币余额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in balancesResult" :key="item.address" class="border-t">
                <td class="px-3 py-2">{{ item.index }}</td>
                <td class="px-3 py-2 font-mono text-xs break-all">{{ item.address }}</td>
                <td class="px-3 py-2">{{ item.sol }}</td>
                <td class="px-3 py-2">{{ item.token }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-base font-semibold text-slate-800">从私钥转账</h3>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="label">选择来源私钥</label>
            <select v-model="selectedKeyIndex" class="input">
              <option disabled value="">选择行号</option>
              <option v-for="(key, idx) in parsedPrivateKeys" :key="idx" :value="idx">
                行 {{ idx + 1 }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">接收地址</label>
            <input v-model="transferTo" class="input" placeholder="目标地址">
          </div>
          <div>
            <label class="label">转账数量</label>
            <input v-model="transferAmount" type="number" step="any" min="0" class="input" placeholder="数量">
          </div>
        </div>
        <button class="btn" @click="onTransfer" :disabled="transferLoading">
          {{ transferLoading ? '转账中...' : '执行转账' }}
        </button>
        <p v-if="transferError" class="text-sm text-red-500">{{ transferError }}</p>
        <p v-if="transferSig" class="text-sm text-emerald-600 break-all">
          交易签名：{{ transferSig }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

definePageMeta({ ssr: false })
useHead({ title: '新增端口' })

// --- 查询 NFT 持有人 ---
const holderTokenAddress = ref('D9VY7opNKZzwhkU5SwwNLDgM5Qab1eoSQUPrgoRSyFGt')
const holdersLoading = ref(false)
const holdersError = ref('')
const holdersResult = ref([])
const holdersSummary = ref({ totalHolders: 0, totalAmount: 0 })

const fetchHolders = async () => {
  holdersLoading.value = true
  holdersError.value = ''
  holdersResult.value = []
  holdersSummary.value = { totalHolders: 0, totalAmount: 0 }

  try {
    const res = await $fetch('/api/tools/nft-holders', {
      method: 'POST',
      body: { tokenAddress: holderTokenAddress.value.trim() },
    })
    holdersResult.value = res?.holders || []
    holdersSummary.value = res?.summary || { totalHolders: 0, totalAmount: 0 }
  } catch (err) {
    holdersError.value = err?.data?.message || err?.message || '查询失败'
  } finally {
    holdersLoading.value = false
  }
}

// --- 私钥批量查询与转账 ---
const batchTokenAddress = ref('FP2i79n4Ar29GRRNCoeBfcwHzwpb5i11qW3oBh5QxgmS')
const privateKeysRaw = ref(`S6u2cGcYE4XeDrAhZnKWR63zr9ysDuan2coL7yEt1HYYCUWyoc3tp8n5YRv7dMNkN3f2hQr8HEo5Uxtp45p18a7
4UaKcFDDBjjBbx6Cw3BC3e1UkFuCeLnGWuvsNbEtuk5RjAWHwzG8wBF6WiLbxHWxibGqNb992kFAeUHrGaZBu2sU
aYzc7XmeoGX1YMXon5ArwXRKzFp9rUV2UeHEwEzqNQxySyregLdTbEbVtnbVWJCKm1jt4EJfVeDEDi2gfHRMCyf
5DLNgVtqra96suGC7QmvWgtsVYN2Hv8dtQCsbB3tKekD8AK4Ekn6BuXYgvf6guTNJYFj1A5k1Q41tG1wSFwGUYkp
2sSk9CNwfe8KcsKcmVBEGnHyXcSf2rtbzQVCtajXq4eTdhakQEb11ZtmVAx96yojbZpVFmUDfUjCXH5GMVqUKP2m
3NboaWcM6DYVwGLiNHH47BzKyoCkai8pm2gHSwravbfbfzQyWdjCNwrhncoJCrvnJVJPcDBHFT1Zqx1NNbd8qtbb
4LxRdrx3guPKvj97ZF66M6ySgjDyseVGS6A5BdBbCiKKydUCr93UjGkbwHnrzPPi5HHMFESL23NkzRKiLqTZCd7u
3JavyUtfzztnmXJr8cCGUSpxsiA3jyxmjEGJz8PC9KMqoc5N5xQeiJnawYQqzmPdkddo2dq1C1JmcQxatV6QwH7R
5RfjKC9xmUZQVmzsbWZctG5wcLb1iCVZ8Ho3EYybXbtEWwHiFb5rY9YRYoFafrcFB48CETHZLL8ZTVP6UHsg9SNy
4qkjL7ogagDoMEBVG5hrZo2octWELYpyXZiTQ3yiAHmKtEpEh3C9P77fcCMu7i8JHhhDHerLvY4wQmctf2mBsf77
3h31PwLoBWRBnETEXCCmjxddqg54fPXodmQw2hhbPJ3N3i47W6UmTMT2WCS2ZhTLR45BQUspXbK8RgGGXQZepcZe
2QdqDWLUrf5cWPhXfpTdxCTLVEfi6rzZ92YNsJANcgig2mNCCTLrcFVWbevcsTpwqEA9u3tHeL5TQ9sb383LNeZ4
3N7iKKgfpemaEBu4huv9ttDCSjgdSdfj4W8iHGaXUni9Bg8JuiJhV6wR53U2gL6XfxD7sSQvj5myjHLKyAWs4dMG
k9Lf5THJaXAgx1JUNBdmm52uV3eqvdh9uderYijJQ2aFSBFjNnyrmj7YQjFGp4DgP2cMBA9DhSVvVyh3yhf9FaV
5rWGMPaeHzPfhBN4L2Aim7jFhJbkvWU6NrWA8bJGsHjN3goHFmM9j2nGtAxo8D5R14pjQeCsS8AxGGJ3QxkL4egM
LkKwEYnyaZ3HhGF2hcTX7BJXgvXmnXtvvtu366fpmNzSLyVjsWrMzTosaNiqwyphvjLtiWBfQ4nzmFRCshvSrmv
3QG56fm6Zgp6EkkvjM9fS3MxWUGC9jVi4Sx7gmPg4ykmFWCeqQw7bCMkdVAYvVveXDXssGRgzCkoLQXh5oD7YwFm
5PCFu6GR8dFoXo4eSAt2ySpPxYg5h13aaStEbRtWowsbvkKtKsg5RzdsuZ1dB24QfFH9X2mVz3njgwVydHFHo6dx`)

const parsedPrivateKeys = computed(() =>
  privateKeysRaw.value
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
)

const balancesLoading = ref(false)
const balancesError = ref('')
const balancesResult = ref([])
const tokenDecimals = ref(0)

const fetchBalances = async () => {
  balancesLoading.value = true
  balancesError.value = ''
  balancesResult.value = []
  tokenDecimals.value = 0

  try {
    const keys = parsedPrivateKeys.value
    if (!keys.length) {
      throw new Error('请先粘贴私钥列表')
    }

    const res = await $fetch('/api/tools/wallet-balances', {
      method: 'POST',
      body: {
        tokenAddress: batchTokenAddress.value.trim(),
        privateKeys: keys,
      },
    })

    balancesResult.value = res?.results || []
    tokenDecimals.value = res?.decimals ?? 0
  } catch (err) {
    balancesError.value = err?.data?.message || err?.message || '查询失败'
  } finally {
    balancesLoading.value = false
  }
}

const selectedKeyIndex = ref('')
const transferTo = ref('6muJcPnG4AP697nquX7x5XRQohbgKEmJKrS5bGQB9PW7')
const transferAmount = ref('')
const transferLoading = ref(false)
const transferError = ref('')
const transferSig = ref('')

const onTransfer = async () => {
  transferError.value = ''
  transferSig.value = ''

  if (selectedKeyIndex.value === '' || !transferTo.value || !transferAmount.value) {
    transferError.value = '请选择私钥并填写目标地址与数量'
    return
  }

  transferLoading.value = true
  try {
    const keys = parsedPrivateKeys.value
    const keyIdx = Number(selectedKeyIndex.value)
    const keyStr = keys[keyIdx]
    if (!keyStr) {
      throw new Error('未找到对应的私钥')
    }

    const res = await $fetch('/api/tools/wallet-transfer', {
      method: 'POST',
      body: {
        fromPrivateKey: keyStr,
        toAddress: transferTo.value.trim(),
        tokenAddress: batchTokenAddress.value.trim(),
        amount: transferAmount.value,
      },
    })

    transferSig.value = res?.signature || ''
  } catch (err) {
    transferError.value = err?.data?.message || err?.message || '转账失败'
  } finally {
    transferLoading.value = false
  }
}
</script>

<style scoped>
.input {
  @apply w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400;
}
.label {
  @apply block text-xs font-medium text-slate-600 mb-1;
}
</style>

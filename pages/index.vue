<template>
  <div class="container">
    <div class="card mb-5">
      <h2 class="section-title">Solana 钱包签名</h2>
      <p class="subtitle mb-4">通过 signMessage 钱包签名，并把签名发送给后端验证</p>

      <div class="bg-slate-50 border border-slate-200 rounded p-3 text-sm mb-4">
        <div class="font-semibold mb-1">待签名消息：</div>
        <code class="break-all text-emerald-600">{{ signatureMessage }}</code>
      </div>

      <button class="btn" @click="signWithWallet" :disabled="signing">
        {{ signing ? '签名中...' : '使用钱包签名并验证' }}
      </button>

      <div v-if="signatureError" class="mt-4 p-4 rounded bg-red-50 border border-red-200 text-sm">
        {{ signatureError }}
      </div>

      <div v-if="walletSignature" class="mt-4 space-y-3 text-sm">
        <div>
          <div class="font-semibold mb-1">签名（Base64）</div>
          <pre class="bg-slate-900 text-white rounded p-3 break-all">{{ walletSignature }}</pre>
        </div>
        <div>
          <div class="font-semibold mb-1">签名公钥（Base58）</div>
          <pre class="bg-slate-900 text-white rounded p-3 break-all">{{ walletPublicKey }}</pre>
        </div>
        <div v-if="verificationResult">
          <div class="font-semibold mb-1">后端验证结果</div>
          <pre class="bg-white border rounded p-3">{{ JSON.stringify(verificationResult, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div class="card mb-5">
      <h2 class="section-title">导航</h2>
      <div class="flex gap-4 mt-4">
        <button class="btn" type="button" @click="goUser">用户端</button>
        <button class="btn" type="button" @click="goAdmin">管理员端</button>
        <button class="btn" type="button" @click="goNewPort">新增端口</button>
        <button class="btn" type="button" @click="goTest('user')">用户详情</button>
        <button class="btn" type="button" @click="goTest('address')">地址详情</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const router = useRouter()

const signing = ref(false)
const walletSignature = ref('')
const walletPublicKey = ref('')
const verificationResult = ref(null)
const signatureError = ref('')
const signatureMessage = '测试签名消息 - ' + new Date().toISOString()
const goUser = () => router.push('/user/deposit')
const goAdmin = () => router.push('/admin')
const goNewPort = () => router.push('/new-port')
const goTest = (type) => router.push(`/myTest/${type}`)
const signWithWallet = async () => {
  signatureError.value = ''
  verificationResult.value = null
  walletSignature.value = ''
  walletPublicKey.value = ''

  if (typeof window === 'undefined') {
    signatureError.value = '仅可在浏览器中发起签名请求'
    return
  }

  const provider = window?.solana
  if (!provider?.signMessage) {
    signatureError.value = '请安装Solana 钱包'
    return
  }

  signing.value = true
  try {
    if (!provider.isConnected && provider.connect) {
      await provider.connect()
    }

    const encodedMessage = new TextEncoder().encode(signatureMessage)
    const signed = await provider.signMessage(encodedMessage, 'utf8')

    const signatureBase64 = window.btoa(String.fromCharCode(...signed.signature))
    walletSignature.value = signatureBase64
    walletPublicKey.value = signed.publicKey.toString()

    verificationResult.value = await $fetch('/api/verify-signature', {
      method: 'POST',
      body: {
        message: signatureMessage,
        signatureBase64,
        publicKey: walletPublicKey.value
      }
    })
  } catch (err) {
    signatureError.value = err?.message || '签名失败'
  } finally {
    signing.value = false
  }
}
</script>

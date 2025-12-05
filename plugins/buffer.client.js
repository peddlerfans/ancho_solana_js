import { Buffer } from 'buffer'

// 确保客户端环境有全局 Buffer（部分 Solana 依赖需要）
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer
  }
  if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
    globalThis.Buffer = Buffer
  }
})

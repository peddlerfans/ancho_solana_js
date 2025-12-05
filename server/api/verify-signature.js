import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Buffer } from 'node:buffer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { message, signatureBase64, publicKey } = body || {}

  if (!message || !signatureBase64 || !publicKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing message, signatureBase64 or publicKey'
    })
  }

  try {
    const messageUint8Array = new TextEncoder().encode(message)
    const signatureUint8Array = Uint8Array.from(Buffer.from(signatureBase64, 'base64'))
    const publicKeyUint8Array = Uint8Array.from(bs58.decode(publicKey))
    const valid = nacl.sign.detached.verify(messageUint8Array, signatureUint8Array, publicKeyUint8Array)

    return {
      valid,
      message,
      publicKey,
      signatureBase64,
      detail: valid ? '签名与消息匹配，验证通过' : '签名与消息不匹配'
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Failed to verify signature'
    })
  }
})

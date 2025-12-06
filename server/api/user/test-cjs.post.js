// 这个 API 路由文件本身是 ESM 格式，但内部使用 Node.js 的 require
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { signature, mint } = body || {};

    if (!signature || !mint) {
      return { status: 'error', message: 'Missing signature or mint in request body.' };
    }

    // 🚀 关键：使用 require 绕过 Nitro/Vite 对 Solana 依赖链的 ESM 编译
    // 路径是相对路径，从当前 API 目录 (server/api/...) 向上两级到 server/solana/queryTx.cjs
    const { queryTx } = require('../queryTx.cjs'); 
    
    // 调用 CJS 文件中的 Solana 逻辑
    const result = await queryTx(signature, mint);

    if (result && result.err) {
      return { status: 'tx_error', data: result.err };
    }

    if (result) {
      return {
        status: 'success',
        message: 'Solana web3.js and CJS isolation works!',
        data: result
      };
    }

    return { status: 'pending', message: 'Transaction not found or pending.' };
    
  } catch (error) {
    // 如果 require 失败，这个错误会被捕获
    console.error("Test API Handler Error:", error);
    // 抛出错误以在控制台显示，并返回给客户端
    throw createError({
      statusCode: 500,
      statusMessage: `Isolation Test Failed: ${error.message}`
    });
  }
});
// server/api/solana/tx_details.js 
import { defineEventHandler, readBody } from 'h3';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

// ⚠️ 注意：替换为您的Solana RPC endpoint
const SOLANA_RPC_URL = 'https://devnet.helius-rpc.com/?api-key=7faaa130-4d5c-4b24-b37c-6ff5aaf9accb'; 
const connection = new Connection(SOLANA_RPC_URL, 'finalized'); 

export default defineEventHandler(async (event) => {
    try {
        // 接收 walletPublicKey
        const { signature, mintAddress, walletPublicKey } = await readBody(event); 
        
        if (!signature || !mintAddress || !walletPublicKey) {
             event.res.statusCode = 400;
             return { error: 'Missing required parameters (signature, mintAddress, or walletPublicKey).' };
        }
        
        const transaction = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'finalized' 
        });
        
        if (transaction === null || transaction.meta.err) {
            event.res.statusCode = transaction === null ? 202 : 409;
            return { 
                transaction,
                status: transaction === null ? 'pending' : 'failed',
                message: transaction === null ? 'Transaction not found or pending.' : 'Transaction failed on chain.',
                errorDetails: transaction?.meta.err 
            };
        }
        
        // --- 核心修复：安全获取 accountKeys 变量 ---
        const rawAccountKeys = transaction.transaction.message.getAccountKeys();
        // 确保 accountKeys 是一个原生数组，虽然在这个逻辑中主要用于 toBase58 检查
        const accountKeys = Array.from(rawAccountKeys); 
        
        let totalTransferredAmount = 0;
        let transferDetails = null;
        
        const preBalances = transaction.meta.preTokenBalances || [];
        const postBalances = transaction.meta.postTokenBalances || [];

        // 1. 遍历所有发生变动的 Token 账户
        for (const postBalance of postBalances) {
            
            // 2. 检查 Mint 地址是否匹配
            if (postBalance.mint !== mintAddress) {
                continue;
            }
            
            // 3. 检查 Owner 是否是用户传入的钱包地址
            // postBalance.owner 是代币账户的 owner 地址
            if (postBalance.owner === walletPublicKey) { 
                
                const accountIndex = postBalance.accountIndex;
                const preBalance = preBalances.find(b => b.accountIndex === accountIndex);
                
                if (preBalance) {
                    const preAmount = preBalance.uiTokenAmount.uiAmount;
                    const postAmount = postBalance.uiTokenAmount.uiAmount;
                    const netChange = postAmount - preAmount;
                    
                    // 4. 检查净变动是否为负数（代表转出）
                    if (netChange < 0) {
                        
                        // 找到该钱包账户的转出变动
                        totalTransferredAmount = Math.abs(netChange);
                        
                        // 5. 安全地获取 Token Account 地址
                        const tokenAccountKey = accountKeys[accountIndex];
                        
                        transferDetails = {
                            mint: mintAddress,
                            amount: totalTransferredAmount,
                            change: netChange,
                            tokenAccount: tokenAccountKey ? tokenAccountKey.toBase58() : 'N/A' // 💥 安全访问
                        };
                        
                        // 找到转出源头，退出循环
                        break; 
                    }
                }
            }
        }
        // --- 查找结束 ---

        // 返回逻辑
        return {
            status: 'success',
            message: `Transaction details fetched.`,
            confirmationStatus: transaction.meta.status.confirmationStatus || 'processed',
            slot: transaction.slot,
            
            totalTransferredAmount: totalTransferredAmount, 
            transferDetails: transferDetails,
            
            fee: transaction.meta.fee / LAMPORTS_PER_SOL, 
        };

    } catch (error) {
        console.error('Error in tx_details:', error);
        event.res.statusCode = 500;
        return { 
            error: 'Internal Nuxt server error.', 
            details: error.message 
        };
    }
});
// nuxt.config.js - 最终修复版
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const UNHEAD_INDEX_ABS = join(
  process.cwd(),
  "node_modules/@unhead/vue/dist/index.mjs"
);
const UNHEAD_PROXY_ABS = join(process.cwd(), "aliases/unhead-index-proxy.mjs");
const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  css: ["~/assets/css/tailwind.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  ssr: false,
  
  // ========== 核心修复开始 ==========
  build: {
    analyze: false,
    extractCSS: true,
    // 明确需要转译的包
    transpile: [
      '@solana/web3.js',
      '@solana/spl-token',
      '@coral-xyz/anchor',
      'bn.js',
      'buffer',
      'tweetnacl',
      'bs58'
    ]
  },
  
  security: {
    headers: {
      crossOriginResourcePolicy: "same-origin",
      crossOriginEmbedderPolicy: "require-corp",
    },
  },
  
  vite: {
    resolve: {
      alias: {
        // 1. 修复 unhead 问题
        'unhead': resolve(currentDir, 'node_modules/unhead/dist/index.mjs'),
        '@unhead/vue/dist/index.mjs': UNHEAD_PROXY_ABS,
        
        // 2. 修复 jayson 问题 - 提供正确的文件路径
        'jayson': resolve(currentDir, 'node_modules/jayson/lib/index.js'),
        'jayson/lib/client/browser': resolve(currentDir, 'node_modules/jayson/lib/client/browser/index.js'),
        
        // 3. 修复其他可能的问题
        'superstruct': resolve(currentDir, 'node_modules/superstruct/dist/index.js'),
        'rpc-websockets': resolve(currentDir, 'node_modules/rpc-websockets/dist/index.js'),
        '@noble/hashes/sha3': resolve(currentDir, 'node_modules/@noble/hashes/sha3.js'),
        
        // 4. Solana 相关的修复
        '@solana/web3.js': resolve(currentDir, 'node_modules/@solana/web3.js/lib/index.browser.cjs.js'),
      }
    },
    optimizeDeps: {
      include: [
        // 预构建这些包
        'jayson/lib/index.js',
        'jayson/lib/client/browser/index.js',
        '@solana/web3.js',
        '@solana/spl-token',
        '@coral-xyz/anchor',
        'bn.js',
        'buffer',
        'tweetnacl',
        'bs58',
        'unhead',
        '@unhead/vue'
      ],
      force: true, // 强制重新预构建
      esbuildOptions: {
        // ES模块配置
        mainFields: ['module', 'main', 'browser'],
        resolveExtensions: ['.mjs', '.js', '.ts', '.json']
      }
    },
    build: {
      commonjsOptions: {
        // 将这些包转为 CommonJS
        include: [/jayson/, /@solana/, /@coral-xyz/, /node_modules/],
        transformMixedEsModules: true,
        // 动态 require 转换
        dynamicRequireTargets: [
          'node_modules/@solana/web3.js/**/*.js',
          'node_modules/jayson/**/*.js'
        ]
      },
      rollupOptions: {
        external: [], // 不外部化，全部打包
        output: {
          // 确保模块正确导出
          interop: 'auto'
        }
      }
    }
  },
  
  nitro: {
    preset: "node-server",
    // 服务器端打包配置
    esbuild: {
      options: {
        // 确保 jayson 正确打包
        mainFields: ['module', 'main'],
        resolveExtensions: ['.mjs', '.js', '.ts'],
        // 添加 banner 修复导入
        banner: {
          js: `
            // Fix for jayson import
            import jaysonBrowser from 'jayson/lib/client/browser/index.js';
            if (typeof globalThis !== 'undefined') {
              globalThis.jayson = globalThis.jayson || {};
              globalThis.jayson.client = globalThis.jayson.client || {};
              globalThis.jayson.client.browser = jaysonBrowser;
            }
          `
        }
      }
    },
    // 内联这些包
    inline: [
      'jayson',
      'unhead',
      '@unhead/vue'
    ]
  },
  // ========== 核心修复结束 ==========
  
  routeRules: {
    "/admin/**": { ssr: false },
    "/user/**": { ssr: false },
  },
  
  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    supabaseTable: process.env.SUPABASE_TABLE || "profiles",
    
    public: {
      apiBase: "/api",
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseTable: process.env.SUPABASE_TABLE || "profiles",
    },
  },
  
  compatibilityDate: "2025-11-20",
});
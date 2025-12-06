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
  
  // ========== 关键修复开始 ==========
  build: {
    analyze: false,
    extractCSS: true,
    // 明确转译的包
    transpile: [
      '@solana/web3.js',
      '@solana/spl-token',
      '@coral-xyz/anchor',
      'bn.js',
      'buffer'
      // 注意：不要包含 jayson
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
        [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
        '@unhead/vue/dist/index.mjs': UNHEAD_PROXY_ABS,
        // 修复可能的错误引用
        'jayson': false,  // 设为 false 将阻止导入
        'jayson/lib': false,
        'jayson/lib/client/browser': false
      }
    },
    optimizeDeps: {
      // 只优化实际需要的包
      include: [
        '@solana/web3.js',
        '@solana/spl-token',
        '@coral-xyz/anchor',
        'bn.js',
        'buffer'
      ],
      // 排除 jayson
      exclude: ['jayson']
    },
    // 构建配置
    build: {
      rollupOptions: {
        // 外部化所有可能的误引用
        external: [
          'jayson',
          /^jayson\/.+/,
          'unhead'  // 你的另一个问题可能也相关
        ]
      }
    }
  },
  
  nitro: {
    preset: "node-server",
    // 服务器端外部化
    externals: {
      external: [
        'jayson',
        /^jayson\//
      ]
    },
    // 修复 node-server 预设的打包
    nodeModules: [
      // 明确哪些 node_modules 应该被打包
      '@solana',
      '@coral-xyz',
      'bn.js',
      'buffer'
    ]
  },
  // ========== 关键修复结束 ==========
  
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
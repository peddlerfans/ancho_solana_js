import { join, resolve } from "node:path"; // ⚠️ 确保导入了 resolve
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const UNHEAD_INDEX_ABS = join(
  process.cwd(),
  "node_modules/@unhead/vue/dist/index.mjs"
);
const UNHEAD_PROXY_ABS = join(process.cwd(), "aliases/unhead-index-proxy.mjs");
// 获取当前目录的绝对路径，用于解析 node_modules
const currentDir = dirname(fileURLToPath(import.meta.url));
export default defineNuxtConfig({
  // devtools: { enabled: true },
  css: ["~/assets/css/tailwind.css"],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  ssr: false,

  // 安全设置
  security: {
    headers: {
      crossOriginResourcePolicy: "same-origin",
      crossOriginEmbedderPolicy: "require-corp",
    },
  },

  // Workaround for @unhead/vue export change (CapoPlugin moved to legacy build)
  // vite: {
  //   resolve: {
  //     alias: {
  //       [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
  //       "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,
  //     },
  //   },
  //   optimizeDeps: {
  //     // 告诉 Vite 优化/预打包 jayson 库
  //     include: ["jayson"],
  //   },
  // },

  // 1. 统一的 NITRO 配置 (服务器端打包)
  nitro: {
    preset: "node-server",
    alias: {
      [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
      "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,
    },
    // 强制内联所有 Solana 和相关库，这是服务器端最可靠的兼容性保障
    externals: {
      inline: [
        "jayson",
        "@solana/web3.js",
        "@coral-xyz/anchor",
        "@solana/spl-token",
        "bn.js",
        "buffer",
      ],
      // 仍然将 jayson 标记为 external 以满足某些 resolver 的要求
      external: ["jayson"],
    },
  },

  // 2. 统一的 VITE 配置 (客户端和开发环境打包)
  vite: {
    resolve: {
      alias: {
        // Unhead 别名
        [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
        "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,

        // 🚀 核心修复：直接使用字符串别名，将报错的目录导入重写到正确的文件
        // 错误信息是: "Did you mean to import jayson/lib/client/browser/index.js?"
        "jayson/lib/client/browser": "jayson/lib/client/browser/index.js",

        // 同时兼容带末尾斜杠的导入
        "jayson/lib/client/browser/": "jayson/lib/client/browser/index.js",
      },
    },
    optimizeDeps: {
      include: [
        "jayson",
        "jayson/lib/client/browser/index.js",
        "bn.js",
        "buffer",
      ],
      force: true,
    },
    build: {
      commonjsOptions: {
        include: [/jayson/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: ["jayson", "@solana/web3.js", "@coral-xyz/anchor"],
      },
    },
  },

    // 减少构建体积
  build: {
    analyze: false, 
    extractCSS: true, 
    // 使用 transpile 强制 Babel 处理这些 CommonJS 库
    transpile: [
      'jayson',
      'bn.js',
      '@solana/web3.js',
      '@solana/spl-token',
      '@coral-xyz/anchor'
    ]
  },

  routeRules: {
    "/admin/**": { ssr: false },
    "/user/**": { ssr: false },
  },

  runtimeConfig: {
    // 私有环境变量（仅服务端可访问）
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    // 可选：仅服务端使用的 Service Key，可绕过 RLS（请勿暴露到客户端）
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    supabaseTable: process.env.SUPABASE_TABLE || "profiles",

    // 公开环境变量（客户端也可访问）
    public: {
      apiBase: "/api",
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseTable: process.env.SUPABASE_TABLE || "profiles",
    },
  },

  compatibilityDate: "2025-12-06",
});

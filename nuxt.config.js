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

  vite: {
    resolve: {
      alias: {
        [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
        "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,
        // 关键：将 jayson 重定向到一个空模块
        jayson: "/dev/null",
        "jayson/lib/client/browser": "/dev/null",
      },
    },
    optimizeDeps: {
      // 从优化列表中移除 jayson
      exclude: ["jayson"],
    },
    // 构建配置
    build: {
      rollupOptions: {
        external: ["jayson"], // 外部化 jayson
      },
    },
  },

  nitro: {
    preset: "node-server",
    // 在 Nitro 中忽略 jayson
    externals: {
      external: ["jayson"],
    },
    rollupConfig: {
      external: ["jayson"],
    },
  },

  // 告诉 Nuxt 不要处理 jayson
  build: {
    transpile: [], // 清空 transpile 列表
    // 或者只转译你需要的
    transpile: [
      "@solana/web3.js",
      "@solana/spl-token",
      "@coral-xyz/anchor",
      "bn.js",
      "buffer",
    ],
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

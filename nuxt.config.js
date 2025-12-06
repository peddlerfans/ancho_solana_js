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
  // // 1. 指定服务器监听的IP和端口（重要！）
  // devServer: {
  //   host: "0.0.0.0", // 允许外部访问
  //   port: 3000, // 默认端口
  // },

  // // 2. 如果是SSR模式，确保这是默认值：
  ssr: false,

  // 减少构建体积
  build: {
    analyze: false, // 生产环境关闭分析
    extractCSS: true, // 提取CSS减少JS体积
  },

  // 安全设置
  security: {
    headers: {
      crossOriginResourcePolicy: "same-origin",
      crossOriginEmbedderPolicy: "require-corp",
    },
  },

  // Workaround for @unhead/vue export change (CapoPlugin moved to legacy build)
  vite: {
    resolve: {
      alias: {
        [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
        "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,
      },
    },
    optimizeDeps: {
      // 告诉 Vite 优化/预打包 jayson 库
      include: ["jayson"],
    },
  },

  nitro: {
    preset: "node-server", // 使用Node.js服务器
    alias: {
      [UNHEAD_INDEX_ABS]: UNHEAD_PROXY_ABS,
      "@unhead/vue/dist/index.mjs": UNHEAD_PROXY_ABS,
    },
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

  compatibilityDate: "2025-11-20",
});

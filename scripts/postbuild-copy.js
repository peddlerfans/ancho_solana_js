// scripts/postbuild-copy.js
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const src = path.join(root, "server", "solana", "queryTx.cjs");
const destDir = path.join(root, ".output", "server", "solana");
const dest = path.join(destDir, "queryTx.cjs");

if (!fs.existsSync(src)) {
  console.error("❌ queryTx.cjs not found:", src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log("✅ Copied queryTx.cjs to .output");

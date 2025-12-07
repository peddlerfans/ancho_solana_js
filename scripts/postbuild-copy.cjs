// scripts/postbuild-copy.cjs
const fs = require("fs");
const path = require("path");

const srcDir = path.resolve("server", "solana");
const destDir = path.resolve(".output", "server", "solana");

if (!fs.existsSync(srcDir)) {
  console.error("postbuild-copy: source dir not found:", srcDir);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir);
files.forEach((f) => {
  if (f.endsWith('.cjs')) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    console.log("Copied", f);
  }
});
console.log("postbuild-copy done.");

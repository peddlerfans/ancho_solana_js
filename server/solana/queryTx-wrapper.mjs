import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { queryTx } = require("./queryTx.cjs");

export { queryTx };

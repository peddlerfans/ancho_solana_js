import { testConnection } from "~/plugins/db";

export default defineEventHandler(async () => {
  const isConnected = await testConnection();

  return {
    code: isConnected ? 200 : 500,
    message: isConnected ? "数据库连接正常" : "数据库连接失败",
    timestamp: new Date().toISOString(),
  };
});

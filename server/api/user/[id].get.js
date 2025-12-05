import { query } from "~/plugins/db";

export default defineEventHandler(async (event) => {
  try {
    const { id } = getRouterParams(event);

    // 1. 获取用户基本信息（单条记录）
    const users = await query(
      `SELECT id, username, email, phone, avatar_url, 
              is_active, last_login_at, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return createError({
        statusCode: 404,
        statusMessage: "用户不存在",
      });
    }

    const user = users[0]; // 获取第一个（也是唯一一个）用户

    // 2. 单独获取用户的地址列表
    const addresses = await query(
      `SELECT * FROM user_addresses 
       WHERE user_id = ? 
       ORDER BY is_default DESC, created_at DESC`,
      [id]
    );

    // 3. 组合数据
    user.addresses = addresses;

    return {
      code: 200,
      data: user,
      message: "success",
    };
  } catch (error) {
    console.error("获取用户详情失败:", error);
    return createError({
      statusCode: 500,
      statusMessage: "获取用户详情失败",
    });
  }
});

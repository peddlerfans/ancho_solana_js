import { query } from "~/plugins/db";

export default defineEventHandler(async (event) => {
  try {
    const { id } = getRouterParams(event);
    
    // 检查用户是否存在
    const userCheck = await query(
      `SELECT id FROM users WHERE id = ?`,
      [id]
    );
    
    if (userCheck.length === 0) {
      return createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      });
    }
    
    const addresses = await query(
      `SELECT * FROM user_addresses 
       WHERE user_id = ? 
       ORDER BY is_default DESC, created_at DESC`,
      [id]
    );
    
    return {
      code: 200,
      data: addresses,
      message: 'success'
    };
  } catch (error) {
    console.error('获取地址列表失败:', error);
    return createError({
      statusCode: 500,
      statusMessage: '获取地址列表失败',
      data: { error: error.message }
    });
  }
});
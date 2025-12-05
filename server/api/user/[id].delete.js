import { query } from "~/plugins/db";

export default defineEventHandler(async (event) => {
  try {
    const { id } = getRouterParams(event);
    
    // 检查用户是否存在
    const existingUser = await query(
      `SELECT id FROM users WHERE id = ?`,
      [id]
    );
    
    if (existingUser.length === 0) {
      return createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      });
    }
    
    // 使用事务确保数据一致性
    await query('START TRANSACTION');
    
    try {
      // 先删除用户的地址（外键约束会级联删除）
      await query(
        `DELETE FROM user_addresses WHERE user_id = ?`,
        [id]
      );
      
      // 删除用户
      await query(
        `DELETE FROM users WHERE id = ?`,
        [id]
      );
      
      await query('COMMIT');
      
      return {
        code: 200,
        data: { id },
        message: '用户删除成功'
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('删除用户失败:', error);
    return createError({
      statusCode: 500,
      statusMessage: '删除用户失败',
      data: { error: error.message }
    });
  }
});
import { query } from "~/plugins/db";
import { hash } from 'bcrypt';

export default defineEventHandler(async (event) => {
  try {
    const { id } = getRouterParams(event);
    const body = await readBody(event);
    
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
    
    // 如果更新邮箱，检查是否重复
    if (body.email) {
      const emailCheck = await query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [body.email, id]
      );
      
      if (emailCheck.length > 0) {
        return createError({
          statusCode: 400,
          statusMessage: '邮箱已被其他用户使用'
        });
      }
    }
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = ['username', 'email', 'phone', 'avatar_url', 'is_active'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(body[field]);
      }
    });
    
    // 如果有密码，需要加密
    if (body.password) {
      const saltRounds = 10;
      const passwordHash = await hash(body.password, saltRounds);
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }
    
    if (updateFields.length === 0) {
      return createError({
        statusCode: 400,
        statusMessage: '没有可更新的字段'
      });
    }
    
    updateValues.push(id);
    
    // 执行更新
    await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // 获取更新后的用户信息
    const updatedUser = await query(
      `SELECT id, username, email, phone, avatar_url, 
              is_active, last_login_at, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
    
    return {
      code: 200,
      data: updatedUser[0],
      message: '用户更新成功'
    };
  } catch (error) {
    console.error('更新用户失败:', error);
    return createError({
      statusCode: 500,
      statusMessage: '更新用户失败',
      data: { error: error.message }
    });
  }
});
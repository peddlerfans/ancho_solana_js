import { query } from '~/plugins/db';
import bcrypt from 'bcrypt';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // 验证必填字段
    const requiredFields = ['username', 'email', 'password'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return createError({
        statusCode: 400,
        statusMessage: `缺少必要字段: ${missingFields.join(', ')}`
      });
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return createError({
        statusCode: 400,
        statusMessage: '邮箱格式不正确'
      });
    }
    
    // 检查用户名和邮箱是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [body.username, body.email]
    );
    
    if (existingUser.length > 0) {
      return createError({
        statusCode: 400,
        statusMessage: '用户名或邮箱已存在'
      });
    }
    
    // 密码加密
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);
    
    // 插入用户
    const result = await query(
      `INSERT INTO users 
       (username, email, password_hash, phone, avatar_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.username,
        body.email,
        passwordHash,
        body.phone || '',
        body.avatar_url || '',
        body.is_active !== undefined ? body.is_active : 1
      ]
    );
    
    // 获取刚创建的用户信息
    const newUser = await query(
      `SELECT id, username, email, phone, avatar_url, 
              is_active, created_at 
       FROM users WHERE id = ?`,
      [result.insertId]
    );
    
    return {
      code: 201,
      data: newUser[0],
      message: '用户创建成功'
    };
  } catch (error) {
    console.error('创建用户失败:', error);
    return createError({
      statusCode: 500,
      statusMessage: '创建用户失败'
    });
  }
});
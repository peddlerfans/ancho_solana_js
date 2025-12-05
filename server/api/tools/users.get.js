import { query } from "~/plugins/db";

export default defineEventHandler(async (event) => {
  try {
    const queryParams = getQuery(event);
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const offset = (page - 1) * limit;
    const search = queryParams.search || "";


    // 🎯 方案A：完全使用你已验证的SQL结构，只改分页部分
    let sql = `
      SELECT u.*, 
             COUNT(a.id) as address_count
      FROM users u
      LEFT JOIN user_addresses a ON u.id = a.user_id
    `;
    
    let params = [];

    // 添加搜索条件
    if (search && search.trim()) {
      sql += " WHERE u.username LIKE ? OR u.email LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    // 添加分组和排序
    sql += " GROUP BY u.id ORDER BY u.created_at DESC";

    // 🚨 关键修复：先获取所有匹配的数据，然后在内存中分页
    // 对于少量数据这是可行的

    const allUsers = await query(sql, params);

    // 内存分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const users = allUsers.slice(startIndex, endIndex);
    const total = allUsers.length;

    return {
      code: 200,
      data: {
        list: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      message: "success"
    };

  } catch (error) {
    console.error("❌ 获取用户列表失败:", error);
    console.error("错误详情:", {
      message: error.message,
      code: error.code,
      sql: error.sql,
      params: error.params
    });
    
    return {
      code: 500,
      message: "获取用户列表失败",
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? {
        sql: error.sql,
        code: error.code
      } : undefined
    };
  }
});
import mysql from 'mysql2/promise';

// 创建连接池（生产环境用连接池更高效）
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nuxt_app',
  waitForConnections: true,
  connectionLimit: 10, // 连接池大小
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+08:00' // 东八区
});

// 测试连接
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL 连接失败:', error);
    return false;
  }
}

// 查询封装
export async function query(sql, params) {
  try {
    const [rows] = await pool.execute(sql, params || []);
    return rows;
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

export { pool };
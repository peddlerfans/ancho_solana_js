export default defineEventHandler(async (event) => {
  const db = event.context.db;
    
  const [rows] = await db.query("SELECT * FROM bs_user LIMIT 10");

  return {
    code: 0,
    data: rows
  }
});

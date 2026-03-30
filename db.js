import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || "localhost",
  port:            parseInt(process.env.DB_PORT) || 3306,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME     || "inbody_viewer",
  connectionLimit: 10,
});

export async function getPool() {
  return pool;
}

export async function initSchema() {
  const db = await getPool();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      user_id      VARCHAR(50)   NOT NULL,
      user_token   VARCHAR(20),
      equip        VARCHAR(100),
      equip_serial VARCHAR(50),
      test_at      VARCHAR(14)   NOT NULL,
      account      VARCHAR(100),
      is_temp      TINYINT(1)    NOT NULL DEFAULT 0,
      inbody_data  JSON,
      fetch_status VARCHAR(30)   DEFAULT 'pending',
      fetch_error  TEXT,
      received_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id   (user_id),
      INDEX idx_received_at (received_at)
    )
  `);

  console.log("[db] Schema initialized");
}

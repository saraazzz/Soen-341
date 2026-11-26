require('dotenv').config();
const mysql = require('mysql2/promise');
const { databaseOptions } = require('./database-options');
const pool = mysql.createPool({
  ...databaseOptions(),
  waitForConnections: true,
  connectionLimit: process.env.VERCEL === '1' ? 2 : 10,
  ...(process.env.VERCEL === '1' ? { maxIdle: 0, idleTimeout: 1000 } : {})
});

// Hosted schema is applied explicitly before deployment, never on a cold start.
if (process.env.VERCEL !== '1') pool.query(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    template VARCHAR(50) DEFAULT 'modern',
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`).catch(() => {});

module.exports = { pool };

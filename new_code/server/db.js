require('dotenv').config();
const mysql = require('mysql2/promise');
const { databaseOptions } = require('./database-options');
const pool = mysql.createPool({
  ...databaseOptions(),
  waitForConnections: true,
  connectionLimit: 10
});

pool.query(`
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

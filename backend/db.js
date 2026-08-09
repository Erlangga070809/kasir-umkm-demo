const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

pool.query('SELECT NOW()')
  .then(() => console.log('Database terhubung'))
  .catch(err => console.error('Database connection error:', err.message));

module.exports = pool;

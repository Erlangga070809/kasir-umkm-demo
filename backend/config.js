require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionExpiry: 24 * 60 * 60 * 1000
};

if (!config.databaseUrl) {
  console.error('DATABASE_URL tidak ditemukan di environment variables');
  process.exit(1);
}

module.exports = config;

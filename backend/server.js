const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const transactionRoutes = require('./routes/transactions');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Terlalu banyak permintaan' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login' }
});
app.use('/api/auth/login', loginLimiter);

let frontendPath = path.join(__dirname, '..', 'frontend');
if (!require('fs').existsSync(frontendPath)) {
  frontendPath = path.join(__dirname, 'frontend');
}
if (!require('fs').existsSync(frontendPath)) {
  frontendPath = __dirname;
}

app.use(express.static(frontendPath));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/*', (req, res) => {
  return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Kesalahan server internal'
  });
});

module.exports = app;

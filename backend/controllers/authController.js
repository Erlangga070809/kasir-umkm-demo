const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const config = require('../config');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
    }

    const userResult = await pool.query(
      'SELECT id, store_id, name, email, password, role, active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const user = userResult.rows[0];

    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Akun tidak aktif' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + config.sessionExpiry);

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [user.store_id, user.id, 'login', 'user', user.id, JSON.stringify({ email: user.email }), req.ip]
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: config.sessionExpiry
    });

    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');

    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);

      if (req.user) {
        await pool.query(
          'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [req.user.store_id, req.user.id, 'logout', 'user', req.user.id, JSON.stringify({}), req.ip]
        );
      }
    }

    res.clearCookie('session_token');
    return res.json({ success: true, message: 'Logout berhasil' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getCurrentUser(req, res) {
  try {
    const userResult = await pool.query(
      'SELECT id, store_id, name, email, role, active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = userResult.rows[0];
    const storeResult = await pool.query('SELECT name FROM stores WHERE id = $1', [user.store_id]);
    const storeName = storeResult.rows.length > 0 ? storeResult.rows[0].name : '';

    return res.json({
      success: true,
      data: {
        ...user,
        store_name: storeName
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, password } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET name = $1, password = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name.trim(), hashedPassword, req.user.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [name.trim(), req.user.id]
      );
    }

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_profile', 'user', req.user.id, JSON.stringify({ name: name.trim() }), req.ip]
    );

    return res.json({ success: true, message: 'Profil berhasil diperbarui' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

module.exports = { login, logout, getCurrentUser, updateProfile };

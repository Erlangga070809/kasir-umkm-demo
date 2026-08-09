const pool = require('../db');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
    }

    const sessionResult = await pool.query(
      'SELECT s.user_id, s.expires_at, u.id, u.store_id, u.role, u.active FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
    }

    const session = sessionResult.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      return res.status(401).json({ success: false, message: 'Sesi telah berakhir' });
    }

    if (!session.active) {
      return res.status(403).json({ success: false, message: 'Akun tidak aktif' });
    }

    req.user = {
      id: session.id,
      store_id: session.store_id,
      role: session.role
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan autentikasi' });
  }
}

module.exports = authenticate;

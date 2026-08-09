const pool = require('../db');

async function getOwnerDashboard(req, res) {
  try {
    const { period = 'today' } = req.query;
    const storeId = req.user.store_id;

    let dateFilter;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case '7days':
        dateFilter = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        dateFilter = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        dateFilter = todayStart;
    }

    const todayRevenue = await pool.query(
      'SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE store_id = $1 AND status = $2 AND created_at >= $3',
      [storeId, 'completed', todayStart]
    );

    const periodRevenue = await pool.query(
      'SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE store_id = $1 AND status = $2 AND created_at >= $3',
      [storeId, 'completed', dateFilter]
    );

    const todayTransactionCount = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE store_id = $1 AND status = $2 AND created_at >= $3',
      [storeId, 'completed', todayStart]
    );

    const periodTransactionCount = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE store_id = $1 AND status = $2 AND created_at >= $3',
      [storeId, 'completed', dateFilter]
    );

    const todayItemsSold = await pool.query(
      `SELECT COALESCE(SUM(ti.quantity), 0) as total 
       FROM transaction_items ti 
       JOIN transactions t ON ti.transaction_id = t.id 
       WHERE t.store_id = $1 AND t.status = $2 AND t.created_at >= $3`,
      [storeId, 'completed', todayStart]
    );

    const lowStockProducts = await pool.query(
      'SELECT * FROM products WHERE store_id = $1 AND stock <= minimum_stock AND active = true ORDER BY stock ASC LIMIT 5',
      [storeId]
    );

    const topProducts = await pool.query(
      `SELECT p.id, p.name, SUM(ti.quantity) as total_sold, SUM(ti.subtotal) as total_revenue 
       FROM transaction_items ti 
       JOIN transactions t ON ti.transaction_id = t.id 
       JOIN products p ON ti.product_id = p.id 
       WHERE t.store_id = $1 AND t.status = $2 AND t.created_at >= $3 
       GROUP BY p.id, p.name 
       ORDER BY total_sold DESC LIMIT 5`,
      [storeId, 'completed', dateFilter]
    );

    const recentTransactions = await pool.query(
      `SELECT t.*, u.name as cashier_name 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.store_id = $1 
       ORDER BY t.created_at DESC LIMIT 5`,
      [storeId]
    );

    const paymentMethods = await pool.query(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total 
       FROM transactions 
       WHERE store_id = $1 AND status = $2 AND created_at >= $3 
       GROUP BY payment_method`,
      [storeId, 'completed', dateFilter]
    );

    const recentActivities = await pool.query(
      `SELECT al.*, u.name as user_name 
       FROM audit_logs al 
       JOIN users u ON al.user_id = u.id 
       WHERE al.store_id = $1 
       ORDER BY al.created_at DESC LIMIT 10`,
      [storeId]
    );

    const dailySales = await pool.query(
      `SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as total, COUNT(*) as transaction_count 
       FROM transactions 
       WHERE store_id = $1 AND status = $2 AND created_at >= $3 
       GROUP BY DATE(created_at) 
       ORDER BY date ASC`,
      [storeId, 'completed', dateFilter]
    );

    return res.json({
      success: true,
      data: {
        today_revenue: parseFloat(todayRevenue.rows[0].total),
        period_revenue: parseFloat(periodRevenue.rows[0].total),
        today_transactions: parseInt(todayTransactionCount.rows[0].count),
        period_transactions: parseInt(periodTransactionCount.rows[0].count),
        today_items_sold: parseInt(todayItemsSold.rows[0].total),
        low_stock_products: lowStockProducts.rows,
        top_products: topProducts.rows,
        recent_transactions: recentTransactions.rows,
        payment_methods: paymentMethods.rows,
        recent_activities: recentActivities.rows,
        daily_sales: dailySales.rows
      }
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getCashierDashboard(req, res) {
  try {
    const storeId = req.user.store_id;
    const userId = req.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTransactions = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE store_id = $1 AND user_id = $2 AND status = $3 AND created_at >= $4',
      [storeId, userId, 'completed', todayStart]
    );

    const todaySales = await pool.query(
      'SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE store_id = $1 AND user_id = $2 AND status = $3 AND created_at >= $4',
      [storeId, userId, 'completed', todayStart]
    );

    const todayItems = await pool.query(
      `SELECT COALESCE(SUM(ti.quantity), 0) as total 
       FROM transaction_items ti 
       JOIN transactions t ON ti.transaction_id = t.id 
       WHERE t.store_id = $1 AND t.user_id = $2 AND t.status = $3 AND t.created_at >= $4`,
      [storeId, userId, 'completed', todayStart]
    );

    const recentTransactions = await pool.query(
      `SELECT t.*, c.name as customer_name 
       FROM transactions t 
       LEFT JOIN customers c ON t.customer_id = c.id 
       WHERE t.store_id = $1 AND t.user_id = $2 
       ORDER BY t.created_at DESC LIMIT 5`,
      [storeId, userId]
    );

    const storeResult = await pool.query('SELECT name, address, phone FROM stores WHERE id = $1', [storeId]);
    const store = storeResult.rows[0] || {};

    return res.json({
      success: true,
      data: {
        today_transactions: parseInt(todayTransactions.rows[0].count),
        today_sales: parseFloat(todaySales.rows[0].total),
        today_items: parseInt(todayItems.rows[0].total),
        recent_transactions: recentTransactions.rows,
        store
      }
    });
  } catch (error) {
    console.error('Cashier dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getReports(req, res) {
  try {
    const { type, date_from, date_to } = req.query;
    const storeId = req.user.store_id;

    let dateFilter = '';
    const params = [storeId];
    let paramIndex = 2;

    if (date_from) {
      dateFilter += ` AND t.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      dateFilter += ` AND t.created_at <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(date_to);
      paramIndex++;
    }

    let result;

    switch (type) {
      case 'products':
        result = await pool.query(
          `SELECT p.id, p.name, p.sku, SUM(ti.quantity) as total_sold, SUM(ti.subtotal) as total_revenue, COUNT(DISTINCT t.id) as transaction_count 
           FROM transaction_items ti 
           JOIN transactions t ON ti.transaction_id = t.id 
           JOIN products p ON ti.product_id = p.id 
           WHERE t.store_id = $1 AND t.status = 'completed' ${dateFilter} 
           GROUP BY p.id, p.name, p.sku 
           ORDER BY total_sold DESC`,
          params
        );
        break;
      case 'cashiers':
        result = await pool.query(
          `SELECT u.id, u.name, u.email, COUNT(t.id) as transaction_count, COALESCE(SUM(t.total), 0) as total_sales 
           FROM users u 
           LEFT JOIN transactions t ON u.id = t.user_id AND t.status = 'completed' ${dateFilter.replace('t.created_at', 't.created_at')} 
           WHERE u.store_id = $1 AND u.role = 'cashier' 
           GROUP BY u.id, u.name, u.email 
           ORDER BY total_sales DESC`,
          params
        );
        break;
      case 'stock':
        result = await pool.query(
          'SELECT * FROM products WHERE store_id = $1 ORDER BY stock ASC',
          [storeId]
        );
        break;
      default:
        result = await pool.query(
          `SELECT DATE(t.created_at) as date, COUNT(*) as transaction_count, COALESCE(SUM(t.total), 0) as total, AVG(t.total) as average 
           FROM transactions t 
           WHERE t.store_id = $1 AND t.status = 'completed' ${dateFilter} 
           GROUP BY DATE(t.created_at) 
           ORDER BY date DESC`,
          params
        );
    }

    const summary = await pool.query(
      `SELECT COALESCE(SUM(total), 0) as total_revenue, COUNT(*) as total_transactions, AVG(total) as average_transaction 
       FROM transactions 
       WHERE store_id = $1 AND status = 'completed' ${dateFilter}`,
      params
    );

    return res.json({
      success: true,
      data: {
        summary: summary.rows[0],
        details: result.rows
      }
    });
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT al.*, u.name as user_name 
      FROM audit_logs al 
      JOIN users u ON al.user_id = u.id 
      WHERE al.store_id = $1
    `;
    const params = [req.user.store_id];

    if (action) {
      query += ` AND al.action = $2`;
      params.push(action);
    }

    const countResult = await pool.query(
      query.replace(/SELECT al\.\*, u\.name as user_name/, 'SELECT COUNT(*)'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getStoreSettings(req, res) {
  try {
    const result = await pool.query('SELECT * FROM stores WHERE id = $1', [req.user.store_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Toko tidak ditemukan' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get store settings error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateStoreSettings(req, res) {
  try {
    const allowedFields = [
      'name', 'address', 'phone', 'email', 'city', 'postal_code', 'description',
      'receipt_show_logo', 'receipt_show_address', 'receipt_show_phone',
      'receipt_footer', 'receipt_thank_you', 'receipt_invoice_prefix',
      'tax_enabled', 'tax_percentage',
      'discount_enabled', 'discount_percentage', 'discount_max',
      'payment_cash', 'payment_transfer', 'payment_qris', 'payment_debit', 'payment_ewallet',
      'stock_minimum_default', 'stock_warning_enabled', 'stock_allow_empty', 'stock_prevent_negative'
    ];

    const updates = [];
    const params = [req.user.store_id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diperbarui' });
    }

    params.push(req.user.store_id);
    const query = `UPDATE stores SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, params);

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_store_settings', 'store', req.user.store_id, JSON.stringify(req.body), req.ip]
    );

    return res.json({ success: true, message: 'Pengaturan berhasil diperbarui', data: result.rows[0] });
  } catch (error) {
    console.error('Update store settings error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

module.exports = {
  getOwnerDashboard,
  getCashierDashboard,
  getReports,
  getAuditLogs,
  getStoreSettings,
  updateStoreSettings
};

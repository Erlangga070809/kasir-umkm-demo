const pool = require('../db');

async function getTransactions(req, res) {
  try {
    const { search, date_from, date_to, user_id, payment_method, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT t.*, u.name as cashier_name, c.name as customer_name 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      LEFT JOIN customers c ON t.customer_id = c.id 
      WHERE t.store_id = $1
    `;
    const params = [req.user.store_id];
    let paramIndex = 2;

    if (search) {
      query += ` AND (t.invoice_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (date_from) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      query += ` AND t.created_at <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(date_to);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND t.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (payment_method) {
      query += ` AND t.payment_method = $${paramIndex}`;
      params.push(payment_method);
      paramIndex++;
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = query.replace(/SELECT t\.\*, u\.name as cashier_name, c\.name as customer_name/, 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
    console.error('Get transactions error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getTransactionById(req, res) {
  try {
    const transaction = await pool.query(
      'SELECT t.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone FROM transactions t JOIN users u ON t.user_id = u.id LEFT JOIN customers c ON t.customer_id = c.id WHERE t.id = $1 AND t.store_id = $2',
      [req.params.id, req.user.store_id]
    );

    if (transaction.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const items = await pool.query(
      'SELECT ti.* FROM transaction_items ti WHERE ti.transaction_id = $1',
      [req.params.id]
    );

    const payment = await pool.query(
      'SELECT * FROM payments WHERE transaction_id = $1',
      [req.params.id]
    );

    return res.json({
      success: true,
      data: {
        ...transaction.rows[0],
        items: items.rows,
        payments: payment.rows
      }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function createTransaction(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { items, customer_id, payment_method, amount_paid, notes } = req.body;

    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Keranjang tidak boleh kosong' });
    }

    if (!payment_method) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Metode pembayaran wajib dipilih' });
    }

    if (!amount_paid || parseFloat(amount_paid) < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Jumlah bayar tidak valid' });
    }

    const storeResult = await client.query('SELECT * FROM stores WHERE id = $1', [req.user.store_id]);
    const store = storeResult.rows[0];

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND store_id = $2 AND active = true',
        [item.product_id, req.user.store_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Produk dengan ID ${item.product_id} tidak ditemukan` });
      }

      const product = productResult.rows[0];
      const quantity = parseInt(item.quantity);

      if (quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Jumlah produk tidak valid' });
      }

      if (store.stock_prevent_negative && product.stock < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Stok ${product.name} tidak mencukupi. Tersedia: ${product.stock}` });
      }

      const itemSubtotal = parseFloat(product.selling_price) * quantity;
      subtotal += itemSubtotal;

      validatedItems.push({
        product,
        quantity,
        price: parseFloat(product.selling_price),
        subtotal: itemSubtotal
      });
    }

    let discountAmount = 0;
    if (store.discount_enabled && store.discount_percentage > 0) {
      discountAmount = subtotal * (parseFloat(store.discount_percentage) / 100);
      if (store.discount_max > 0 && discountAmount > parseFloat(store.discount_max)) {
        discountAmount = parseFloat(store.discount_max);
      }
    }

    let taxAmount = 0;
    if (store.tax_enabled && store.tax_percentage > 0) {
      taxAmount = (subtotal - discountAmount) * (parseFloat(store.tax_percentage) / 100);
    }

    const total = subtotal - discountAmount + taxAmount;
    const changeAmount = parseFloat(amount_paid) - total;

    if (parseFloat(amount_paid) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Jumlah bayar kurang' });
    }

    const invoiceNumber = `${store.receipt_invoice_prefix}-${Date.now().toString(36).toUpperCase()}`;

    const transactionResult = await client.query(
      `INSERT INTO transactions (store_id, user_id, customer_id, invoice_number, subtotal, discount_amount, tax_amount, total, payment_method, amount_paid, change_amount, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed') RETURNING *`,
      [
        req.user.store_id,
        req.user.id,
        customer_id || null,
        invoiceNumber,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        payment_method,
        parseFloat(amount_paid),
        changeAmount,
        notes || null
      ]
    );

    const transaction = transactionResult.rows[0];

    for (const item of validatedItems) {
      await client.query(
        'INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, price, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [transaction.id, item.product.id, item.product.name, item.quantity, item.price, item.subtotal]
      );

      const newStock = item.product.stock - item.quantity;
      await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, item.product.id]);

      await client.query(
        `INSERT INTO stock_movements (store_id, product_id, user_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, notes) 
         VALUES ($1, $2, $3, 'out', $4, $5, $6, 'transaction', $7, $8)`,
        [req.user.store_id, item.product.id, req.user.id, item.quantity, item.product.stock, newStock, transaction.id, 'Penjualan']
      );
    }

    await client.query(
      'INSERT INTO payments (transaction_id, method, amount) VALUES ($1, $2, $3)',
      [transaction.id, payment_method, parseFloat(amount_paid)]
    );

    if (customer_id) {
      await client.query(
        'UPDATE customers SET total_transactions = total_transactions + 1, total_spent = total_spent + $1, last_transaction_at = CURRENT_TIMESTAMP WHERE id = $2',
        [total, customer_id]
      );
    }

    await client.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'create_transaction', 'transaction', transaction.id, JSON.stringify({ invoice_number: invoiceNumber, total }), req.ip]
    );

    await client.query('COMMIT');

    const resultItems = await client.query(
      'SELECT * FROM transaction_items WHERE transaction_id = $1',
      [transaction.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil',
      data: {
        ...transaction,
        items: resultItems.rows,
        store: {
          name: store.name,
          address: store.address,
          phone: store.phone,
          receipt_show_logo: store.receipt_show_logo,
          receipt_show_address: store.receipt_show_address,
          receipt_show_phone: store.receipt_show_phone,
          receipt_footer: store.receipt_footer,
          receipt_thank_you: store.receipt_thank_you
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create transaction error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  } finally {
    client.release();
  }
}

async function getCustomers(req, res) {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM customers WHERE store_id = $1';
    const params = [req.user.store_id];

    if (search) {
      query += ' AND (name ILIKE $2 OR phone ILIKE $2)';
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM customers WHERE store_id = $1${search ? ' AND (name ILIKE $2 OR phone ILIKE $2)' : ''}`,
      search ? [req.user.store_id, `%${search}%`] : [req.user.store_id]
    );
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY last_transaction_at DESC NULLS LAST, name ASC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    console.error('Get customers error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function createCustomer(req, res) {
  try {
    const { name, phone } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
    }

    if (phone) {
      const phoneCheck = await pool.query(
        'SELECT id FROM customers WHERE store_id = $1 AND phone = $2',
        [req.user.store_id, phone.trim()]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Nomor telepon sudah digunakan' });
      }
    }

    const result = await pool.query(
      'INSERT INTO customers (store_id, name, phone) VALUES ($1, $2, $3) RETURNING *',
      [req.user.store_id, name.trim(), phone ? phone.trim() : null]
    );

    return res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan', data: result.rows[0] });
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getCashiers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
        (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) as transaction_count,
        (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.user_id = u.id) as total_sales
       FROM users u 
       WHERE u.store_id = $1 AND u.role = 'cashier' 
       ORDER BY u.created_at DESC`,
      [req.user.store_id]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get cashiers error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function createCashier(req, res) {
  try {
    const { name, email, password } = req.body;
    const bcrypt = require('bcryptjs');

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama kasir wajib diisi' });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Email kasir wajib diisi' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }

    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (store_id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, active, created_at',
      [req.user.store_id, name.trim(), email.toLowerCase().trim(), hashedPassword, 'cashier']
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'create_cashier', 'user', result.rows[0].id, JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim() }), req.ip]
    );

    return res.status(201).json({ success: true, message: 'Kasir berhasil ditambahkan', data: result.rows[0] });
  } catch (error) {
    console.error('Create cashier error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateCashier(req, res) {
  try {
    const { name, active } = req.body;

    const cashierCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND store_id = $2 AND role = $3',
      [req.params.id, req.user.store_id, 'cashier']
    );

    if (cashierCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kasir tidak ditemukan' });
    }

    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), active = COALESCE($2, active), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND store_id = $4 RETURNING id, name, email, role, active, created_at',
      [name ? name.trim() : null, active !== undefined ? active : null, req.params.id, req.user.store_id]
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_cashier', 'user', req.params.id, JSON.stringify(req.body), req.ip]
    );

    return res.json({ success: true, message: 'Kasir berhasil diperbarui', data: result.rows[0] });
  } catch (error) {
    console.error('Update cashier error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function resetCashierPassword(req, res) {
  try {
    const bcrypt = require('bcryptjs');
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }

    const cashierCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND store_id = $2 AND role = $3',
      [req.params.id, req.user.store_id, 'cashier']
    );

    if (cashierCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kasir tidak ditemukan' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.params.id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'reset_cashier_password', 'user', req.params.id, JSON.stringify({}), req.ip]
    );

    return res.json({ success: true, message: 'Password kasir berhasil direset' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  getCustomers,
  createCustomer,
  getCashiers,
  createCashier,
  updateCashier,
  resetCashierPassword
};

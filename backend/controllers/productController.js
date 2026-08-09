const pool = require('../db');

async function getProducts(req, res) {
  try {
    const { search, category_id, stock_status, sort_by, sort_order, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.store_id = $1
    `;
    const params = [req.user.store_id];
    let paramIndex = 2;

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category_id) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (stock_status === 'low') {
      query += ` AND p.stock <= p.minimum_stock AND p.stock > 0`;
    } else if (stock_status === 'out') {
      query += ` AND p.stock <= 0`;
    } else if (stock_status === 'safe') {
      query += ` AND p.stock > p.minimum_stock`;
    }

    const countQuery = query.replace('SELECT p.*, c.name as category_name', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const validSortColumns = ['name', 'sku', 'selling_price', 'stock', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const order = sort_order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY p.${sortColumn} ${order}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
    console.error('Get products error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getProductById(req, res) {
  try {
    const result = await pool.query(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1 AND p.store_id = $2',
      [req.params.id, req.user.store_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function createProduct(req, res) {
  try {
    const { name, sku, category_id, purchase_price, selling_price, stock, minimum_stock, active } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama produk wajib diisi' });
    }

    if (!selling_price || parseFloat(selling_price) < 0) {
      return res.status(400).json({ success: false, message: 'Harga jual wajib diisi' });
    }

    if (sku) {
      const skuCheck = await pool.query(
        'SELECT id FROM products WHERE store_id = $1 AND sku = $2',
        [req.user.store_id, sku.trim()]
      );
      if (skuCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'SKU sudah digunakan' });
      }
    }

    const defaultMinStock = await pool.query(
      'SELECT stock_minimum_default FROM stores WHERE id = $1',
      [req.user.store_id]
    );
    const minStock = minimum_stock || (defaultMinStock.rows[0]?.stock_minimum_default || 10);

    const result = await pool.query(
      `INSERT INTO products (store_id, name, sku, category_id, purchase_price, selling_price, stock, minimum_stock, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.user.store_id,
        name.trim(),
        sku ? sku.trim() : null,
        category_id || null,
        parseFloat(purchase_price) || 0,
        parseFloat(selling_price),
        parseInt(stock) || 0,
        parseInt(minStock),
        active !== undefined ? active : true
      ]
    );

    const product = result.rows[0];

    if (parseInt(stock) > 0) {
      await pool.query(
        `INSERT INTO stock_movements (store_id, product_id, user_id, type, quantity, previous_stock, new_stock, reference_type, notes) 
         VALUES ($1, $2, $3, 'in', $4, 0, $4, 'initial', 'Stok awal')`,
        [req.user.store_id, product.id, req.user.id, parseInt(stock)]
      );
    }

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'create_product', 'product', product.id, JSON.stringify({ name: product.name }), req.ip]
    );

    return res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', data: product });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateProduct(req, res) {
  try {
    const { name, sku, category_id, purchase_price, selling_price, minimum_stock, active } = req.body;

    const existingProduct = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND store_id = $2',
      [req.params.id, req.user.store_id]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    if (sku && sku.trim() !== existingProduct.rows[0].sku) {
      const skuCheck = await pool.query(
        'SELECT id FROM products WHERE store_id = $1 AND sku = $2 AND id != $3',
        [req.user.store_id, sku.trim(), req.params.id]
      );
      if (skuCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'SKU sudah digunakan' });
      }
    }

    const result = await pool.query(
      `UPDATE products SET 
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        category_id = $3,
        purchase_price = COALESCE($4, purchase_price),
        selling_price = COALESCE($5, selling_price),
        minimum_stock = COALESCE($6, minimum_stock),
        active = COALESCE($7, active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND store_id = $9 RETURNING *`,
      [
        name ? name.trim() : null,
        sku ? sku.trim() : null,
        category_id !== undefined ? category_id : existingProduct.rows[0].category_id,
        purchase_price !== undefined ? parseFloat(purchase_price) : null,
        selling_price !== undefined ? parseFloat(selling_price) : null,
        minimum_stock !== undefined ? parseInt(minimum_stock) : null,
        active !== undefined ? active : null,
        req.params.id,
        req.user.store_id
      ]
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_product', 'product', req.params.id, JSON.stringify(req.body), req.ip]
    );

    return res.json({ success: true, message: 'Produk berhasil diperbarui', data: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function deleteProduct(req, res) {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND store_id = $2 RETURNING *',
      [req.params.id, req.user.store_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'delete_product', 'product', req.params.id, JSON.stringify({ name: result.rows[0].name }), req.ip]
    );

    return res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateStock(req, res) {
  try {
    const { quantity, type, notes } = req.body;

    if (!quantity || parseInt(quantity) === 0) {
      return res.status(400).json({ success: false, message: 'Jumlah stok tidak valid' });
    }

    if (!['in', 'out', 'adjustment'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipe perubahan stok tidak valid' });
    }

    const product = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND store_id = $2',
      [req.params.id, req.user.store_id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    const currentStock = product.rows[0].stock;
    let newStock = currentStock;

    if (type === 'in') {
      newStock = currentStock + parseInt(quantity);
    } else if (type === 'out') {
      newStock = currentStock - parseInt(quantity);
    } else if (type === 'adjustment') {
      newStock = parseInt(quantity);
    }

    const storeSettings = await pool.query(
      'SELECT stock_prevent_negative FROM stores WHERE id = $1',
      [req.user.store_id]
    );

    if (storeSettings.rows[0]?.stock_prevent_negative && newStock < 0) {
      return res.status(400).json({ success: false, message: 'Stok tidak boleh negatif' });
    }

    await pool.query(
      'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStock, req.params.id]
    );

    await pool.query(
      `INSERT INTO stock_movements (store_id, product_id, user_id, type, quantity, previous_stock, new_stock, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user.store_id, req.params.id, req.user.id, type, Math.abs(parseInt(quantity)), currentStock, newStock, notes || null]
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_stock', 'product', req.params.id, JSON.stringify({ type, quantity: parseInt(quantity), previous_stock: currentStock, new_stock: newStock }), req.ip]
    );

    return res.json({ success: true, message: 'Stok berhasil diperbarui', data: { stock: newStock } });
  } catch (error) {
    console.error('Update stock error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getCategories(req, res) {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*, COUNT(p.id) as product_count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.category_id AND p.store_id = $1 
      WHERE c.store_id = $1
    `;
    const params = [req.user.store_id];

    if (search) {
      query += ` AND c.name ILIKE $2`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY c.id ORDER BY c.name ASC`;

    const result = await pool.query(query, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function createCategory(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const existingCategory = await pool.query(
      'SELECT id FROM categories WHERE store_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.store_id, name.trim()]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Kategori sudah ada' });
    }

    const result = await pool.query(
      'INSERT INTO categories (store_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.store_id, name.trim()]
    );

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'create_category', 'category', result.rows[0].id, JSON.stringify({ name: name.trim() }), req.ip]
    );

    return res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan', data: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function updateCategory(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const existingCategory = await pool.query(
      'SELECT id FROM categories WHERE store_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [req.user.store_id, name.trim(), req.params.id]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Kategori sudah ada' });
    }

    const result = await pool.query(
      'UPDATE categories SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND store_id = $3 RETURNING *',
      [name.trim(), req.params.id, req.user.store_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    }

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'update_category', 'category', req.params.id, JSON.stringify({ name: name.trim() }), req.ip]
    );

    return res.json({ success: true, message: 'Kategori berhasil diperbarui', data: result.rows[0] });
  } catch (error) {
    console.error('Update category error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function deleteCategory(req, res) {
  try {
    const productCount = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND store_id = $2',
      [req.params.id, req.user.store_id]
    );

    if (parseInt(productCount.rows[0].count) > 0) {
      return res.status(400).json({ success: false, message: 'Kategori masih digunakan oleh produk' });
    }

    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND store_id = $2 RETURNING *',
      [req.params.id, req.user.store_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    }

    await pool.query(
      'INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.store_id, req.user.id, 'delete_category', 'category', req.params.id, JSON.stringify({ name: result.rows[0].name }), req.ip]
    );

    return res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getStockMovements(req, res) {
  try {
    const { product_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT sm.*, p.name as product_name, u.name as user_name 
      FROM stock_movements sm 
      JOIN products p ON sm.product_id = p.id 
      JOIN users u ON sm.user_id = u.id 
      WHERE sm.store_id = $1
    `;
    const params = [req.user.store_id];
    let paramIndex = 2;

    if (product_id) {
      query += ` AND sm.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    query += ` ORDER BY sm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM stock_movements WHERE store_id = $1${product_id ? ' AND product_id = $2' : ''}`,
      product_id ? [req.user.store_id, product_id] : [req.user.store_id]
    );
    const total = parseInt(countResult.rows[0].count);

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
    console.error('Get stock movements error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

async function getLowStockProducts(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE store_id = $1 AND stock <= minimum_stock AND active = true ORDER BY stock ASC',
      [req.user.store_id]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get low stock error:', error);
    return res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getStockMovements,
  getLowStockProducts
};

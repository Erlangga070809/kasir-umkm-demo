document.addEventListener('DOMContentLoaded', async () => {
  try {
    const userData = await app.request('/auth/me');
    app.user = userData.data;
    document.getElementById('sidebarUserName').textContent = app.user.name;
    document.getElementById('topbarUser').textContent = app.user.name;

    initNavigation();
    initSidebar();
    loadPage('dashboard');
  } catch (error) {
    window.location.href = 'login.html';
  }

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
      await app.request('/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = 'login.html';
  });
});

function initSidebar() {
  const toggle = document.getElementById('topbarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  });
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.getAttribute('data-page');
      document.getElementById('topbarTitle').textContent = item.textContent.trim();
      loadPage(page);

      document.getElementById('sidebar').classList.remove('active');
      document.getElementById('sidebarOverlay').classList.remove('active');
    });
  });
}

async function loadPage(page) {
  const content = document.getElementById('pageContent');

  switch (page) {
    case 'dashboard':
      await loadDashboard(content);
      break;
    case 'products':
      await loadProducts(content);
      break;
    case 'categories':
      await loadCategories(content);
      break;
    case 'stock':
      await loadStock(content);
      break;
    case 'transactions':
      await loadTransactions(content);
      break;
    case 'customers':
      await loadCustomers(content);
      break;
    case 'cashiers':
      await loadCashiers(content);
      break;
    case 'reports':
      await loadReports(content);
      break;
    case 'activities':
      await loadActivities(content);
      break;
    case 'settings':
      await loadSettings(content);
      break;
    case 'profile':
      await loadProfile(content);
      break;
    default:
      content.innerHTML = '<p>Halaman tidak ditemukan</p>';
  }
}

async function loadDashboard(container) {
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card glass-card"><div class="skeleton" style="height:80px"></div></div>
      <div class="stat-card glass-card"><div class="skeleton" style="height:80px"></div></div>
      <div class="stat-card glass-card"><div class="skeleton" style="height:80px"></div></div>
      <div class="stat-card glass-card"><div class="skeleton" style="height:80px"></div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="skeleton" style="height:300px"></div></div>
      <div class="card"><div class="skeleton" style="height:300px"></div></div>
    </div>
  `;

  try {
    const data = await app.request('/dashboard/owner?period=today');
    const d = data.data;

    container.innerHTML = `
      <div class="card-header" style="margin-bottom:16px;">
        <div></div>
        <div style="display:flex;gap:8px;">
          <button class="tab ${getActivePeriod()==='today'?'active':''}" onclick="changePeriod('today')">Hari Ini</button>
          <button class="tab ${getActivePeriod()==='7days'?'active':''}" onclick="changePeriod('7days')">7 Hari</button>
          <button class="tab ${getActivePeriod()==='30days'?'active':''}" onclick="changePeriod('30days')">30 Hari</button>
          <button class="tab ${getActivePeriod()==='this_month'?'active':''}" onclick="changePeriod('this_month')">Bulan Ini</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${app.formatCurrency(d.today_revenue)}</div>
          <div class="stat-label">Omzet Hari Ini</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-value">${d.today_transactions}</div>
          <div class="stat-label">Transaksi Hari Ini</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${d.today_items_sold}</div>
          <div class="stat-label">Produk Terjual</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon">⚠</div>
          <div class="stat-value">${d.low_stock_products.length}</div>
          <div class="stat-label">Stok Menipis</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3 class="card-title">Produk Terlaris</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>Produk</th><th>Terjual</th><th>Pendapatan</th></tr></thead>
              <tbody>
                ${d.top_products.length > 0
                  ? d.top_products.map(p => `<tr><td>${app.escapeHtml(p.name)}</td><td>${p.total_sold}</td><td>${app.formatCurrency(p.total_revenue)}</td></tr>`).join('')
                  : '<tr><td colspan="3"><div class="empty-state"><p>Belum ada data penjualan</p></div></td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h3 class="card-title">Transaksi Terbaru</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>No</th><th>Kasir</th><th>Total</th><th>Waktu</th></tr></thead>
              <tbody>
                ${d.recent_transactions.length > 0
                  ? d.recent_transactions.map(t => `<tr><td>${app.escapeHtml(t.invoice_number)}</td><td>${app.escapeHtml(t.cashier_name)}</td><td>${app.formatCurrency(t.total)}</td><td>${app.formatDate(t.created_at)}</td></tr>`).join('')
                  : '<tr><td colspan="4"><div class="empty-state"><p>Belum ada transaksi</p></div></td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:24px;">
        <h3 class="card-title">Grafik Penjualan</h3>
        <div class="preview-chart" style="height:200px;">
          ${d.daily_sales.map(s => {
            const maxTotal = Math.max(...d.daily_sales.map(x => parseFloat(x.total)), 1);
            const height = (parseFloat(s.total) / maxTotal * 100);
            return `<div class="preview-bar" style="height:${height}%;flex:1;" title="${s.date}: ${app.formatCurrency(s.total)}"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-around;margin-top:8px;font-size:11px;color:var(--text-muted);">
          ${d.daily_sales.slice(-7).map(s => `<span>${new Date(s.date).getDate()}/${new Date(s.date).getMonth()+1}</span>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">Aktivitas Terbaru</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>User</th><th>Aksi</th><th>Waktu</th></tr></thead>
            <tbody>
              ${d.recent_activities.length > 0
                ? d.recent_activities.map(a => `<tr><td>${app.escapeHtml(a.user_name)}</td><td>${app.escapeHtml(a.action)}</td><td>${app.formatDate(a.created_at)}</td></tr>`).join('')
                : '<tr><td colspan="3"><div class="empty-state"><p>Belum ada aktivitas</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat dashboard: ${error.message}</div>`;
  }
}

function getActivePeriod() {
  return new URLSearchParams(window.location.search).get('period') || 'today';
}

function changePeriod(period) {
  const url = new URL(window.location);
  url.searchParams.set('period', period);
  window.history.pushState({}, '', url);
  loadPage('dashboard');
}

async function loadProducts(container) {
  container.innerHTML = `<div class="skeleton" style="height:400px"></div>`;

  try {
    const productsData = await app.request('/products?limit=100');
    const categoriesData = await app.request('/products/categories');
    const products = productsData.data;
    const categories = categoriesData.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Daftar Produk (${productsData.pagination.total})</h3>
          <button class="btn btn-primary btn-sm" onclick="showProductForm()">+ Tambah Produk</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" class="form-input" placeholder="Cari produk..." style="max-width:300px;" oninput="searchProducts(this.value)">
          <select class="form-select" style="max-width:200px;" onchange="filterProductsByCategory(this.value)">
            <option value="">Semua Kategori</option>
            ${categories.map(c => `<option value="${c.id}">${app.escapeHtml(c.name)}</option>`).join('')}
          </select>
          <select class="form-select" style="max-width:200px;" onchange="filterProductsByStock(this.value)">
            <option value="">Semua Stok</option>
            <option value="low">Stok Menipis</option>
            <option value="out">Stok Habis</option>
            <option value="safe">Stok Aman</option>
          </select>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Nama</th><th>SKU</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody id="productsTableBody">
              ${products.length > 0
                ? products.map(p => `
                  <tr>
                    <td>${app.escapeHtml(p.name)}</td>
                    <td>${p.sku || '-'}</td>
                    <td>${app.escapeHtml(p.category_name || '-')}</td>
                    <td>${app.formatCurrency(p.selling_price)}</td>
                    <td><span class="badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= p.minimum_stock ? 'badge-warning' : 'badge-success'}">${p.stock}</span></td>
                    <td><span class="badge ${p.active ? 'badge-success' : 'badge-danger'}">${p.active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Hapus</button>
                    </td>
                  </tr>`).join('')
                : '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-title">Belum ada produk</div><div class="empty-state-description">Tambahkan produk pertama untuk mulai berjualan.</div><button class="btn btn-primary" onclick="showProductForm()">Tambah Produk</button></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat produk: ${error.message}</div>`;
  }
}

function showProductForm(productId = null) {
  const isEdit = !!productId;
  app.showModal(isEdit ? 'Edit Produk' : 'Tambah Produk', `
    <div class="skeleton" style="height:200px"></div>
    <div id="productFormContainer"></div>
  `);

  setTimeout(async () => {
    let product = null;
    const categoriesData = await app.request('/products/categories');
    const categories = categoriesData.data;

    if (isEdit) {
      const data = await app.request(`/products/${productId}`);
      product = data.data;
    }

    document.getElementById('productFormContainer').innerHTML = `
      <form id="productForm">
        <div class="form-group">
          <label class="form-label">Nama Produk</label>
          <input type="text" class="form-input" name="name" required value="${product ? app.escapeHtml(product.name) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">SKU</label>
          <input type="text" class="form-input" name="sku" value="${product && product.sku ? app.escapeHtml(product.sku) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select" name="category_id">
            <option value="">Tanpa Kategori</option>
            ${categories.map(c => `<option value="${c.id}" ${product && product.category_id === c.id ? 'selected' : ''}>${app.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Harga Beli</label>
            <input type="number" class="form-input" name="purchase_price" value="${product ? product.purchase_price : '0'}">
          </div>
          <div class="form-group">
            <label class="form-label">Harga Jual</label>
            <input type="number" class="form-input" name="selling_price" required value="${product ? product.selling_price : ''}">
          </div>
        </div>
        ${!isEdit ? `
          <div class="form-group">
            <label class="form-label">Stok Awal</label>
            <input type="number" class="form-input" name="stock" value="0">
          </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Minimum Stok</label>
            <input type="number" class="form-input" name="minimum_stock" value="${product ? product.minimum_stock : '10'}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" name="active">
              <option value="true" ${product && product.active ? 'selected' : ''}>Aktif</option>
              <option value="false" ${product && !product.active ? 'selected' : ''}>Nonaktif</option>
            </select>
          </div>
        </div>
        <div id="productFormError" class="alert alert-error" style="display:none;"></div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</button>
      </form>
    `;

    document.getElementById('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        if (isEdit) {
          await app.request(`/products/${productId}`, { method: 'PUT', body: data });
          app.showToast('Produk berhasil diperbarui', 'success');
        } else {
          await app.request('/products', { method: 'POST', body: data });
          app.showToast('Produk berhasil ditambahkan', 'success');
        }
        app.closeModal();
        loadPage('products');
      } catch (error) {
        document.getElementById('productFormError').textContent = error.message;
        document.getElementById('productFormError').style.display = 'block';
      }
    });
  }, 100);
}

function editProduct(id) {
  showProductForm(id);
}

async function deleteProduct(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;

  try {
    await app.request(`/products/${id}`, { method: 'DELETE' });
    app.showToast('Produk berhasil dihapus', 'success');
    loadPage('products');
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function searchProducts(query) {
  loadPage('products');
}

async function filterProductsByCategory(categoryId) {
  loadPage('products');
}

async function filterProductsByStock(status) {
  loadPage('products');
}

async function loadCategories(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/products/categories');
    const categories = data.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Kategori</h3>
          <button class="btn btn-primary btn-sm" onclick="showCategoryForm()">+ Tambah Kategori</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Nama</th><th>Jumlah Produk</th><th>Aksi</th></tr></thead>
            <tbody>
              ${categories.length > 0
                ? categories.map(c => `
                  <tr>
                    <td>${app.escapeHtml(c.name)}</td>
                    <td>${c.product_count}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="showCategoryForm('${c.id}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')">Hapus</button>
                    </td>
                  </tr>`).join('')
                : '<tr><td colspan="3"><div class="empty-state"><p>Belum ada kategori</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat kategori: ${error.message}</div>`;
  }
}

function showCategoryForm(categoryId = null) {
  const isEdit = !!categoryId;
  app.showModal(isEdit ? 'Edit Kategori' : 'Tambah Kategori', `
    <form id="categoryForm">
      <div class="form-group">
        <label class="form-label">Nama Kategori</label>
        <input type="text" class="form-input" name="name" required id="categoryName">
      </div>
      <div id="categoryFormError" class="alert alert-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Simpan' : 'Tambah'}</button>
    </form>
  `);

  if (isEdit) {
    app.request(`/products/categories`).then(data => {
      const cat = data.data.find(c => c.id === categoryId);
      if (cat) document.getElementById('categoryName').value = cat.name;
    });
  }

  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('categoryName').value;

    try {
      if (isEdit) {
        await app.request(`/products/categories/${categoryId}`, { method: 'PUT', body: { name } });
        app.showToast('Kategori berhasil diperbarui', 'success');
      } else {
        await app.request('/products/categories', { method: 'POST', body: { name } });
        app.showToast('Kategori berhasil ditambahkan', 'success');
      }
      app.closeModal();
      loadPage('categories');
    } catch (error) {
      document.getElementById('categoryFormError').textContent = error.message;
      document.getElementById('categoryFormError').style.display = 'block';
    }
  });
}

async function deleteCategory(id) {
  if (!confirm('Hapus kategori ini?')) return;
  try {
    await app.request(`/products/categories/${id}`, { method: 'DELETE' });
    app.showToast('Kategori berhasil dihapus', 'success');
    loadPage('categories');
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function loadStock(container) {
  container.innerHTML = `<div class="skeleton" style="height:400px"></div>`;

  try {
    const productsData = await app.request('/products?limit=200');
    const movementsData = await app.request('/products/stock-movements?limit=50');
    const products = productsData.data;
    const movements = movementsData.data;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-value">${products.filter(p => p.stock > p.minimum_stock).length}</div>
          <div class="stat-label">Stok Aman</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value">${products.filter(p => p.stock <= p.minimum_stock && p.stock > 0).length}</div>
          <div class="stat-label">Stok Menipis</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value">${products.filter(p => p.stock <= 0).length}</div>
          <div class="stat-label">Stok Habis</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:24px;">
        <h3 class="card-title">Status Stok</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Produk</th><th>Stok</th><th>Minimum</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td>${app.escapeHtml(p.name)}</td>
                  <td>${p.stock}</td>
                  <td>${p.minimum_stock}</td>
                  <td><span class="badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= p.minimum_stock ? 'badge-warning' : 'badge-success'}">${p.stock <= 0 ? 'Habis' : p.stock <= p.minimum_stock ? 'Menipis' : 'Aman'}</span></td>
                  <td><button class="btn btn-outline btn-sm" onclick="showStockAdjustment('${p.id}')">Sesuaikan</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">Riwayat Perubahan Stok</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Produk</th><th>Tipe</th><th>Jumlah</th><th>Stok Lama</th><th>Stok Baru</th><th>User</th><th>Waktu</th></tr></thead>
            <tbody>
              ${movements.length > 0
                ? movements.map(m => `
                  <tr>
                    <td>${app.escapeHtml(m.product_name)}</td>
                    <td><span class="badge badge-info">${m.type}</span></td>
                    <td>${m.quantity}</td>
                    <td>${m.previous_stock}</td>
                    <td>${m.new_stock}</td>
                    <td>${app.escapeHtml(m.user_name)}</td>
                    <td>${app.formatDate(m.created_at)}</td>
                  </tr>`).join('')
                : '<tr><td colspan="7"><div class="empty-state"><p>Belum ada riwayat</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat stok: ${error.message}</div>`;
  }
}

function showStockAdjustment(productId) {
  app.showModal('Penyesuaian Stok', `
    <form id="stockForm">
      <div class="form-group">
        <label class="form-label">Tipe</label>
        <select class="form-select" name="type" required>
          <option value="in">Stok Masuk</option>
          <option value="out">Stok Keluar</option>
          <option value="adjustment">Penyesuaian</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Jumlah</label>
        <input type="number" class="form-input" name="quantity" required min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Catatan</label>
        <input type="text" class="form-input" name="notes">
      </div>
      <div id="stockFormError" class="alert alert-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-full">Simpan</button>
    </form>
  `);

  document.getElementById('stockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      await app.request(`/products/${productId}/stock`, { method: 'PUT', body: data });
      app.showToast('Stok berhasil diperbarui', 'success');
      app.closeModal();
      loadPage('stock');
    } catch (error) {
      document.getElementById('stockFormError').textContent = error.message;
      document.getElementById('stockFormError').style.display = 'block';
    }
  });
}

async function loadTransactions(container) {
  container.innerHTML = `<div class="skeleton" style="height:400px"></div>`;

  try {
    const data = await app.request('/transactions?limit=100');
    const transactions = data.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Daftar Transaksi (${data.pagination.total})</h3>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>No</th><th>Tanggal</th><th>Kasir</th><th>Total</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${transactions.length > 0
                ? transactions.map(t => `
                  <tr>
                    <td>${app.escapeHtml(t.invoice_number)}</td>
                    <td>${app.formatDate(t.created_at)}</td>
                    <td>${app.escapeHtml(t.cashier_name)}</td>
                    <td>${app.formatCurrency(t.total)}</td>
                    <td>${t.payment_method}</td>
                    <td><span class="badge badge-success">${t.status}</span></td>
                    <td><button class="btn btn-outline btn-sm" onclick="viewTransaction('${t.id}')">Detail</button></td>
                  </tr>`).join('')
                : '<tr><td colspan="7"><div class="empty-state"><p>Belum ada transaksi</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat transaksi: ${error.message}</div>`;
  }
}

async function viewTransaction(id) {
  try {
    const data = await app.request(`/transactions/${id}`);
    const t = data.data;

    app.showModal(`Detail Transaksi - ${t.invoice_number}`, `
      <div class="receipt">
        <div class="receipt-title">KASIR UMKM</div>
        <p>No: ${app.escapeHtml(t.invoice_number)}</p>
        <p>${app.formatDate(t.created_at)}</p>
        <p>Kasir: ${app.escapeHtml(t.cashier_name)}</p>
        <hr class="receipt-divider">
        ${t.items.map(item => `
          <div class="receipt-row">
            <span>${app.escapeHtml(item.product_name)} x${item.quantity}</span>
            <span>${app.formatCurrency(item.subtotal)}</span>
          </div>
        `).join('')}
        <hr class="receipt-divider">
        <div class="receipt-row"><span>Subtotal</span><span>${app.formatCurrency(t.subtotal)}</span></div>
        ${t.discount_amount > 0 ? `<div class="receipt-row"><span>Diskon</span><span>-${app.formatCurrency(t.discount_amount)}</span></div>` : ''}
        ${t.tax_amount > 0 ? `<div class="receipt-row"><span>Pajak</span><span>${app.formatCurrency(t.tax_amount)}</span></div>` : ''}
        <div class="receipt-row" style="font-weight:700;"><span>TOTAL</span><span>${app.formatCurrency(t.total)}</span></div>
        <div class="receipt-row"><span>Bayar (${t.payment_method})</span><span>${app.formatCurrency(t.amount_paid)}</span></div>
        <div class="receipt-row"><span>Kembali</span><span>${app.formatCurrency(t.change_amount)}</span></div>
        <hr class="receipt-divider">
        <div class="receipt-footer">Terima kasih telah berbelanja</div>
      </div>
    `);
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function loadCustomers(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/transactions/customers?limit=100');
    const customers = data.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Pelanggan (${data.pagination.total})</h3>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Nama</th><th>Telepon</th><th>Total Transaksi</th><th>Total Belanja</th><th>Terakhir</th></tr></thead>
            <tbody>
              ${customers.length > 0
                ? customers.map(c => `
                  <tr>
                    <td>${app.escapeHtml(c.name)}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.total_transactions}</td>
                    <td>${app.formatCurrency(c.total_spent)}</td>
                    <td>${app.formatDate(c.last_transaction_at)}</td>
                  </tr>`).join('')
                : '<tr><td colspan="5"><div class="empty-state"><p>Belum ada pelanggan</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat pelanggan: ${error.message}</div>`;
  }
}

async function loadCashiers(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/transactions/cashiers');
    const cashiers = data.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Manajemen Kasir</h3>
          <button class="btn btn-primary btn-sm" onclick="showCashierForm()">+ Tambah Kasir</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Nama</th><th>Email</th><th>Transaksi</th><th>Total Penjualan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${cashiers.length > 0
                ? cashiers.map(c => `
                  <tr>
                    <td>${app.escapeHtml(c.name)}</td>
                    <td>${app.escapeHtml(c.email)}</td>
                    <td>${c.transaction_count}</td>
                    <td>${app.formatCurrency(c.total_sales)}</td>
                    <td><span class="badge ${c.active ? 'badge-success' : 'badge-danger'}">${c.active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="editCashier('${c.id}')">Edit</button>
                      <button class="btn btn-outline btn-sm" onclick="resetCashierPassword('${c.id}')">Reset Password</button>
                    </td>
                  </tr>`).join('')
                : '<tr><td colspan="6"><div class="empty-state"><p>Belum ada kasir</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat kasir: ${error.message}</div>`;
  }
}

function showCashierForm(cashierId = null) {
  const isEdit = !!cashierId;
  app.showModal(isEdit ? 'Edit Kasir' : 'Tambah Kasir', `
    <form id="cashierForm">
      <div class="form-group">
        <label class="form-label">Nama</label>
        <input type="text" class="form-input" name="name" required id="cashierName">
      </div>
      ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" name="email" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required minlength="6">
        </div>
      ` : `
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" name="active">
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      `}
      <div id="cashierFormError" class="alert alert-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Simpan' : 'Tambah'}</button>
    </form>
  `);

  document.getElementById('cashierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      if (isEdit) {
        await app.request(`/transactions/cashiers/${cashierId}`, { method: 'PUT', body: data });
        app.showToast('Kasir berhasil diperbarui', 'success');
      } else {
        await app.request('/transactions/cashiers', { method: 'POST', body: data });
        app.showToast('Kasir berhasil ditambahkan', 'success');
      }
      app.closeModal();
      loadPage('cashiers');
    } catch (error) {
      document.getElementById('cashierFormError').textContent = error.message;
      document.getElementById('cashierFormError').style.display = 'block';
    }
  });
}

function editCashier(id) {
  showCashierForm(id);
}

async function resetCashierPassword(id) {
  const password = prompt('Masukkan password baru (minimal 6 karakter):');
  if (!password) return;
  try {
    await app.request(`/transactions/cashiers/${id}/reset-password`, { method: 'PUT', body: { password } });
    app.showToast('Password kasir berhasil direset', 'success');
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function loadReports(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/dashboard/reports');
    const report = data.data;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-value">${app.formatCurrency(report.summary.total_revenue)}</div>
          <div class="stat-label">Total Omzet</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value">${report.summary.total_transactions}</div>
          <div class="stat-label">Total Transaksi</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value">${app.formatCurrency(report.summary.average_transaction)}</div>
          <div class="stat-label">Rata-rata Transaksi</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Laporan Penjualan</h3>
          <button class="btn btn-outline btn-sm" onclick="exportReportCSV()">Export CSV</button>
        </div>
        <div class="table-container" id="reportTableContainer">
          <table id="reportTable">
            <thead><tr><th>Tanggal</th><th>Transaksi</th><th>Total</th><th>Rata-rata</th></tr></thead>
            <tbody>
              ${report.details.map(r => `
                <tr>
                  <td>${app.formatDate(r.date)}</td>
                  <td>${r.transaction_count}</td>
                  <td>${app.formatCurrency(r.total)}</td>
                  <td>${app.formatCurrency(r.average)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window._reportData = report;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat laporan: ${error.message}</div>`;
  }
}

function exportReportCSV() {
  if (!window._reportData) return;
  const report = window._reportData;
  let csv = 'Tanggal,Transaksi,Total,Rata-rata\n';
  report.details.forEach(r => {
    csv += `${r.date},${r.transaction_count},${r.total},${r.average}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'laporan_penjualan.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function loadActivities(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/dashboard/audit-logs?limit=100');
    const logs = data.data;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">Log Aktivitas</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>User</th><th>Aksi</th><th>Entitas</th><th>Detail</th><th>Waktu</th></tr></thead>
            <tbody>
              ${logs.length > 0
                ? logs.map(l => `
                  <tr>
                    <td>${app.escapeHtml(l.user_name)}</td>
                    <td>${app.escapeHtml(l.action)}</td>
                    <td>${app.escapeHtml(l.entity_type || '-')}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.details ? JSON.stringify(l.details).substring(0, 60) : '-'}</td>
                    <td>${app.formatDate(l.created_at)}</td>
                  </tr>`).join('')
                : '<tr><td colspan="5"><div class="empty-state"><p>Belum ada log aktivitas</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat aktivitas: ${error.message}</div>`;
  }
}

async function loadSettings(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/dashboard/store-settings');
    const settings = data.data;

    container.innerHTML = `
      <div class="tabs">
        <button class="tab active" onclick="switchSettingsTab('info', this)">Informasi Toko</button>
        <button class="tab" onclick="switchSettingsTab('receipt', this)">Struk</button>
        <button class="tab" onclick="switchSettingsTab('tax', this)">Pajak & Diskon</button>
        <button class="tab" onclick="switchSettingsTab('payment', this)">Pembayaran</button>
        <button class="tab" onclick="switchSettingsTab('stock_settings', this)">Stok</button>
      </div>
      <div id="settingsTabContent"></div>
    `;

    window._storeSettings = settings;
    renderSettingsTab('info');
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat pengaturan: ${error.message}</div>`;
  }
}

function switchSettingsTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderSettingsTab(tab);
}

function renderSettingsTab(tab) {
  const settings = window._storeSettings;
  const container = document.getElementById('settingsTabContent');
  let html = '';

  switch (tab) {
    case 'info':
      html = `
        <form onsubmit="saveSettings(event)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Nama Toko</label><input type="text" class="form-input" name="name" value="${app.escapeHtml(settings.name || '')}"></div>
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="email" value="${app.escapeHtml(settings.email || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label">Alamat</label><textarea class="form-textarea" name="address">${app.escapeHtml(settings.address || '')}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">Kota</label><input type="text" class="form-input" name="city" value="${app.escapeHtml(settings.city || '')}"></div>
            <div class="form-group"><label class="form-label">Kode Pos</label><input type="text" class="form-input" name="postal_code" value="${app.escapeHtml(settings.postal_code || '')}"></div>
            <div class="form-group"><label class="form-label">Telepon</label><input type="text" class="form-input" name="phone" value="${app.escapeHtml(settings.phone || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label">Deskripsi</label><textarea class="form-textarea" name="description">${app.escapeHtml(settings.description || '')}</textarea></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>`;
      break;
    case 'receipt':
      html = `
        <form onsubmit="saveSettings(event)">
          <div class="form-group"><label class="form-label">Prefix Nomor Transaksi</label><input type="text" class="form-input" name="receipt_invoice_prefix" value="${app.escapeHtml(settings.receipt_invoice_prefix || 'INV')}"></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.receipt_show_logo ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="receipt_show_logo"></div><span>Tampilkan Logo</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.receipt_show_address ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="receipt_show_address"></div><span>Tampilkan Alamat</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.receipt_show_phone ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="receipt_show_phone"></div><span>Tampilkan Telepon</span></div>
          <div class="form-group"><label class="form-label">Footer Struk</label><input type="text" class="form-input" name="receipt_footer" value="${app.escapeHtml(settings.receipt_footer || '')}"></div>
          <div class="form-group"><label class="form-label">Ucapan Terima Kasih</label><input type="text" class="form-input" name="receipt_thank_you" value="${app.escapeHtml(settings.receipt_thank_you || '')}"></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>`;
      break;
    case 'tax':
      html = `
        <form onsubmit="saveSettings(event)">
          <div class="toggle-wrapper"><div class="toggle ${settings.tax_enabled ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="tax_enabled"></div><span>Aktifkan Pajak</span></div>
          <div class="form-group"><label class="form-label">Persentase Pajak (%)</label><input type="number" class="form-input" name="tax_percentage" value="${settings.tax_percentage}" step="0.01"></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.discount_enabled ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="discount_enabled"></div><span>Aktifkan Diskon</span></div>
          <div class="form-group"><label class="form-label">Diskon (%)</label><input type="number" class="form-input" name="discount_percentage" value="${settings.discount_percentage}" step="0.01"></div>
          <div class="form-group"><label class="form-label">Batas Maksimal Diskon (Rp)</label><input type="number" class="form-input" name="discount_max" value="${settings.discount_max}"></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>`;
      break;
    case 'payment':
      html = `
        <form onsubmit="saveSettings(event)">
          <div class="toggle-wrapper"><div class="toggle ${settings.payment_cash ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="payment_cash"></div><span>Cash / Tunai</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.payment_transfer ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="payment_transfer"></div><span>Transfer Bank</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.payment_qris ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="payment_qris"></div><span>QRIS</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.payment_debit ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="payment_debit"></div><span>Kartu Debit</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.payment_ewallet ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="payment_ewallet"></div><span>E-Wallet</span></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>`;
      break;
    case 'stock_settings':
      html = `
        <form onsubmit="saveSettings(event)">
          <div class="form-group"><label class="form-label">Minimum Stok Default</label><input type="number" class="form-input" name="stock_minimum_default" value="${settings.stock_minimum_default}"></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.stock_warning_enabled ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="stock_warning_enabled"></div><span>Peringatan Stok Rendah</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.stock_allow_empty ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="stock_allow_empty"></div><span>Izinkan Stok Kosong</span></div>
          <div class="toggle-wrapper"><div class="toggle ${settings.stock_prevent_negative ? 'active' : ''}" onclick="this.classList.toggle('active')" data-field="stock_prevent_negative"></div><span>Cegah Stok Negatif</span></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>`;
      break;
  }

  container.innerHTML = html;
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  const toggles = form.querySelectorAll('.toggle[data-field]');
  toggles.forEach(toggle => {
    data[toggle.getAttribute('data-field')] = toggle.classList.contains('active');
  });

  try {
    await app.request('/dashboard/store-settings', { method: 'PUT', body: data });
    app.showToast('Pengaturan berhasil disimpan', 'success');
    const updated = await app.request('/dashboard/store-settings');
    window._storeSettings = updated.data;
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function loadProfile(container) {
  container.innerHTML = `
    <div class="card" style="max-width:500px;">
      <h3 class="card-title">Profil Saya</h3>
      <div style="margin-bottom:20px;">
        <p><strong>Nama:</strong> ${app.escapeHtml(app.user.name)}</p>
        <p><strong>Email:</strong> ${app.escapeHtml(app.user.email)}</p>
        <p><strong>Role:</strong> ${app.user.role}</p>
        <p><strong>Bergabung:</strong> ${app.formatDate(app.user.created_at)}</p>
      </div>
      <form id="profileForm">
        <div class="form-group">
          <label class="form-label">Nama</label>
          <input type="text" class="form-input" name="name" value="${app.escapeHtml(app.user.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password Baru (kosongkan jika tidak diubah)</label>
          <input type="password" class="form-input" name="password" minlength="6">
        </div>
        <div id="profileFormError" class="alert alert-error" style="display:none;"></div>
        <button type="submit" class="btn btn-primary btn-full">Simpan Perubahan</button>
      </form>
    </div>
  `;

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    if (!data.password) delete data.password;

    try {
      await app.request('/auth/profile', { method: 'PUT', body: data });
      app.showToast('Profil berhasil diperbarui', 'success');
      const updated = await app.request('/auth/me');
      app.user = updated.data;
      document.getElementById('sidebarUserName').textContent = app.user.name;
      loadPage('profile');
    } catch (error) {
      document.getElementById('profileFormError').textContent = error.message;
      document.getElementById('profileFormError').style.display = 'block';
    }
  });
}
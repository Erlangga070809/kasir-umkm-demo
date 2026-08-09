let cart = [];

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
      await loadCashierDashboard(content);
      break;
    case 'pos':
      await loadPOS(content);
      break;
    case 'transactions':
      await loadCashierTransactions(content);
      break;
    case 'customers':
      await loadCashierCustomers(content);
      break;
    case 'profile':
      await loadCashierProfile(content);
      break;
    default:
      content.innerHTML = '<p>Halaman tidak ditemukan</p>';
  }
}

async function loadCashierDashboard(container) {
  container.innerHTML = `<div class="stats-grid"><div class="stat-card glass-card"><div class="skeleton" style="height:80px"></div></div></div>`;

  try {
    const data = await app.request('/dashboard/cashier');
    const d = data.data;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${app.formatCurrency(d.today_sales)}</div>
          <div class="stat-label">Penjualan Hari Ini</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-value">${d.today_transactions}</div>
          <div class="stat-label">Transaksi Hari Ini</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${d.today_items}</div>
          <div class="stat-label">Item Terjual</div>
        </div>
      </div>
      <div style="margin-bottom:24px;">
        <button class="btn btn-primary btn-lg btn-full" onclick="document.querySelector('.nav-item[data-page=pos]').click()">🛒 Mulai Transaksi Baru</button>
      </div>
      <div class="card">
        <h3 class="card-title">Transaksi Terakhir</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>No</th><th>Total</th><th>Metode</th><th>Waktu</th></tr></thead>
            <tbody>
              ${d.recent_transactions.length > 0
                ? d.recent_transactions.map(t => `<tr><td>${app.escapeHtml(t.invoice_number)}</td><td>${app.formatCurrency(t.total)}</td><td>${t.payment_method}</td><td>${app.formatDate(t.created_at)}</td></tr>`).join('')
                : '<tr><td colspan="4"><div class="empty-state"><p>Belum ada transaksi hari ini</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat dashboard: ${error.message}</div>`;
  }
}

async function loadPOS(container) {
  cart = [];
  container.innerHTML = `<div class="skeleton" style="height:400px"></div>`;

  try {
    const productsData = await app.request('/products?limit=200&active=true');
    const categoriesData = await app.request('/products/categories');
    const settingsData = await app.request('/dashboard/store-settings');
    const products = productsData.data.filter(p => p.active);
    const categories = categoriesData.data;
    const settings = settingsData.data;

    window._posProducts = products;
    window._posCategories = categories;
    window._posSettings = settings;

    renderPOS(container, products, categories, null);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat POS: ${error.message}</div>`;
  }
}

function renderPOS(container, products, categories, activeCategory) {
  const filteredProducts = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products;

  const paymentMethods = [];
  if (window._posSettings?.payment_cash) paymentMethods.push('Cash');
  if (window._posSettings?.payment_transfer) paymentMethods.push('Transfer');
  if (window._posSettings?.payment_qris) paymentMethods.push('QRIS');
  if (window._posSettings?.payment_debit) paymentMethods.push('Debit');
  if (window._posSettings?.payment_ewallet) paymentMethods.push('E-Wallet');

  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="pos-search">
          <input type="text" class="form-input" placeholder="🔍 Cari produk..." id="posSearch" oninput="searchPOSProducts(this.value)">
        </div>
        <div class="pos-categories">
          <button class="pos-category ${!activeCategory ? 'active' : ''}" onclick="filterPOSCategory(null)">Semua</button>
          ${categories.map(c => `<button class="pos-category ${activeCategory === c.id ? 'active' : ''}" onclick="filterPOSCategory('${c.id}')">${app.escapeHtml(c.name)}</button>`).join('')}
        </div>
        <div class="pos-grid">
          ${filteredProducts.length > 0
            ? filteredProducts.map(p => `
              <div class="pos-product ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="${p.stock > 0 ? `addToCart('${p.id}')` : ''}">
                <div class="pos-product-name">${app.escapeHtml(p.name)}</div>
                <div class="pos-product-price">${app.formatCurrency(p.selling_price)}</div>
                <div class="pos-product-stock">Stok: ${p.stock}</div>
              </div>`).join('')
            : '<div class="empty-state" style="grid-column:1/-1;"><p>Produk tidak ditemukan</p></div>'}
        </div>
      </div>
      <div class="pos-cart">
        <div class="pos-cart-header">🛒 Keranjang</div>
        <div class="pos-cart-items" id="cartItems">
          ${renderCartItems()}
        </div>
        <div class="pos-cart-summary">
          <div class="pos-cart-row"><span>Subtotal</span><span id="cartSubtotal">${app.formatCurrency(getCartSubtotal())}</span></div>
          <div class="pos-cart-row"><span>Diskon</span><span id="cartDiscount">-${app.formatCurrency(getCartDiscount())}</span></div>
          <div class="pos-cart-row"><span>Pajak</span><span id="cartTax">${app.formatCurrency(getCartTax())}</span></div>
          <div class="pos-cart-row total"><span>TOTAL</span><span id="cartTotal">${app.formatCurrency(getCartTotal())}</span></div>
        </div>
        <div class="pos-cart-checkout">
          <button class="btn btn-success btn-lg btn-full" onclick="showCheckout()" ${cart.length === 0 ? 'disabled' : ''}>💰 BAYAR</button>
        </div>
      </div>
    </div>
  `;
}

function renderCartItems() {
  if (cart.length === 0) {
    return '<div class="empty-state"><p>Keranjang kosong</p><p style="font-size:12px;">Klik produk untuk menambahkan</p></div>';
  }

  return cart.map((item, index) => `
    <div class="pos-cart-item">
      <div class="pos-cart-item-info">
        <div class="pos-cart-item-name">${app.escapeHtml(item.name)}</div>
        <div class="pos-cart-item-price">${app.formatCurrency(item.price)}</div>
      </div>
      <div class="pos-cart-item-qty">
        <button class="qty-btn" onclick="updateCartQty(${index}, -1)">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
      </div>
      <div class="pos-cart-item-subtotal">${app.formatCurrency(item.price * item.quantity)}</div>
      <button class="pos-cart-item-remove" onclick="removeFromCart(${index})">✕</button>
    </div>
  `).join('');
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartDiscount() {
  if (!window._posSettings?.discount_enabled) return 0;
  const discount = getCartSubtotal() * (parseFloat(window._posSettings.discount_percentage) / 100);
  if (window._posSettings.discount_max > 0 && discount > parseFloat(window._posSettings.discount_max)) {
    return parseFloat(window._posSettings.discount_max);
  }
  return discount;
}

function getCartTax() {
  if (!window._posSettings?.tax_enabled) return 0;
  return (getCartSubtotal() - getCartDiscount()) * (parseFloat(window._posSettings.tax_percentage) / 100);
}

function getCartTotal() {
  return getCartSubtotal() - getCartDiscount() + getCartTax();
}

function addToCart(productId) {
  const product = window._posProducts.find(p => p.id === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.product_id === productId);
  if (existingItem) {
    if (existingItem.quantity >= product.stock) {
      app.showToast('Stok tidak mencukupi', 'error');
      return;
    }
    existingItem.quantity++;
  } else {
    if (product.stock <= 0) {
      app.showToast('Stok habis', 'error');
      return;
    }
    cart.push({
      product_id: product.id,
      name: product.name,
      price: parseFloat(product.selling_price),
      quantity: 1,
      max_stock: product.stock,
    });
  }

  updateCartDisplay();
}

function updateCartQty(index, delta) {
  const item = cart[index];
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    cart.splice(index, 1);
  } else if (newQty > item.max_stock) {
    app.showToast('Stok tidak mencukupi', 'error');
    return;
  } else {
    item.quantity = newQty;
  }

  updateCartDisplay();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  if (cartItems) {
    cartItems.innerHTML = renderCartItems();
  }
  const subtotalEl = document.getElementById('cartSubtotal');
  const discountEl = document.getElementById('cartDiscount');
  const taxEl = document.getElementById('cartTax');
  const totalEl = document.getElementById('cartTotal');

  if (subtotalEl) subtotalEl.textContent = app.formatCurrency(getCartSubtotal());
  if (discountEl) discountEl.textContent = `-${app.formatCurrency(getCartDiscount())}`;
  if (taxEl) taxEl.textContent = app.formatCurrency(getCartTax());
  if (totalEl) totalEl.textContent = app.formatCurrency(getCartTotal());

  const checkoutBtn = document.querySelector('.pos-cart-checkout .btn');
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function searchPOSProducts(query) {
  const filtered = window._posProducts.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(query.toLowerCase()))
  );
  renderPOS(document.getElementById('pageContent'), filtered, window._posCategories, null);
}

function filterPOSCategory(categoryId) {
  renderPOS(document.getElementById('pageContent'), window._posProducts, window._posCategories, categoryId);
}

async function showCheckout() {
  if (cart.length === 0) return;

  const total = getCartTotal();
  const paymentMethods = [];
  if (window._posSettings?.payment_cash) paymentMethods.push('Cash');
  if (window._posSettings?.payment_transfer) paymentMethods.push('Transfer');
  if (window._posSettings?.payment_qris) paymentMethods.push('QRIS');
  if (window._posSettings?.payment_debit) paymentMethods.push('Debit');
  if (window._posSettings?.payment_ewallet) paymentMethods.push('E-Wallet');

  try {
    const customersData = await app.request('/transactions/customers?limit=100');
    const customers = customersData.data;

    app.showModal('Pembayaran', `
      <div style="margin-bottom:16px;">
        <div class="pos-cart-row"><span>Subtotal</span><span>${app.formatCurrency(getCartSubtotal())}</span></div>
        <div class="pos-cart-row"><span>Diskon</span><span>-${app.formatCurrency(getCartDiscount())}</span></div>
        <div class="pos-cart-row"><span>Pajak</span><span>${app.formatCurrency(getCartTax())}</span></div>
        <div class="pos-cart-row total"><span>TOTAL</span><span>${app.formatCurrency(total)}</span></div>
      </div>
      <form id="checkoutForm">
        <div class="checkout-grid">
          <div class="form-group">
            <label class="form-label">Metode Pembayaran</label>
            <select class="form-select" name="payment_method" required>
              ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pelanggan</label>
            <select class="form-select" name="customer_id">
              <option value="">Umum</option>
              ${customers.map(c => `<option value="${c.id}">${app.escapeHtml(c.name)} ${c.phone ? '- ' + c.phone : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah Bayar</label>
            <input type="number" class="form-input" name="amount_paid" id="amountPaid" required value="${Math.ceil(total / 1000) * 1000}">
          </div>
          <div class="form-group">
            <label class="form-label">Kembalian</label>
            <input type="text" class="form-input" id="changeAmount" readonly value="${app.formatCurrency(Math.max(0, Math.ceil(total / 1000) * 1000 - total))}">
          </div>
          <div class="form-group checkout-full">
            <label class="form-label">Catatan</label>
            <input type="text" class="form-input" name="notes">
          </div>
        </div>
        <div id="checkoutError" class="alert alert-error" style="display:none;"></div>
        <button type="submit" class="btn btn-success btn-lg btn-full">💳 Bayar Sekarang</button>
      </form>
    `);

    document.getElementById('amountPaid').addEventListener('input', function() {
      const paid = parseFloat(this.value) || 0;
      document.getElementById('changeAmount').value = app.formatCurrency(Math.max(0, paid - total));
    });

    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      data.items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';

      try {
        const result = await app.request('/transactions', { method: 'POST', body: data });
        cart = [];
        app.closeModal();
        showReceipt(result.data);
        app.showToast('Transaksi berhasil!', 'success');
      } catch (error) {
        document.getElementById('checkoutError').textContent = error.message;
        document.getElementById('checkoutError').style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💳 Bayar Sekarang';
      }
    });
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

function showReceipt(transaction) {
  const store = transaction.store || {};

  app.showModal('Transaksi Berhasil ✅', `
    <div class="receipt">
      <div class="receipt-title">KASIR UMKM</div>
      ${store.receipt_show_logo !== false && store.name ? `<p style="font-weight:700;">${app.escapeHtml(store.name)}</p>` : ''}
      ${store.receipt_show_address !== false && store.address ? `<p style="font-size:11px;">${app.escapeHtml(store.address)}</p>` : ''}
      ${store.receipt_show_phone !== false && store.phone ? `<p style="font-size:11px;">${app.escapeHtml(store.phone)}</p>` : ''}
      <hr class="receipt-divider">
      <p>No: ${app.escapeHtml(transaction.invoice_number)}</p>
      <p>${app.formatDate(transaction.created_at)}</p>
      <hr class="receipt-divider">
      ${transaction.items.map(item => `
        <div class="receipt-row">
          <span>${app.escapeHtml(item.product_name)} x${item.quantity}</span>
          <span>${app.formatCurrency(item.subtotal)}</span>
        </div>
      `).join('')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span>Subtotal</span><span>${app.formatCurrency(transaction.subtotal)}</span></div>
      ${transaction.discount_amount > 0 ? `<div class="receipt-row"><span>Diskon</span><span>-${app.formatCurrency(transaction.discount_amount)}</span></div>` : ''}
      ${transaction.tax_amount > 0 ? `<div class="receipt-row"><span>Pajak</span><span>${app.formatCurrency(transaction.tax_amount)}</span></div>` : ''}
      <div class="receipt-row" style="font-weight:700;"><span>TOTAL</span><span>${app.formatCurrency(transaction.total)}</span></div>
      <div class="receipt-row"><span>Bayar</span><span>${app.formatCurrency(transaction.amount_paid)}</span></div>
      <div class="receipt-row"><span>Kembali</span><span>${app.formatCurrency(transaction.change_amount)}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-footer">${store.receipt_thank_you || 'Terima kasih telah berbelanja'}</div>
      ${store.receipt_footer ? `<p style="font-size:10px;">${app.escapeHtml(store.receipt_footer)}</p>` : ''}
    </div>
    <div class="receipt-actions">
      <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Cetak</button>
      <button class="btn btn-primary btn-sm" onclick="app.closeModal();document.querySelector('.nav-item[data-page=pos]').click()">🛒 Transaksi Baru</button>
      <button class="btn btn-outline btn-sm" onclick="app.closeModal()">✕ Tutup</button>
    </div>
  `);
}

async function loadCashierTransactions(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/transactions?limit=100');
    const transactions = data.data;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">Riwayat Transaksi</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>No</th><th>Total</th><th>Metode</th><th>Pelanggan</th><th>Waktu</th><th>Aksi</th></tr></thead>
            <tbody>
              ${transactions.length > 0
                ? transactions.map(t => `
                  <tr>
                    <td>${app.escapeHtml(t.invoice_number)}</td>
                    <td>${app.formatCurrency(t.total)}</td>
                    <td>${t.payment_method}</td>
                    <td>${app.escapeHtml(t.customer_name || '-')}</td>
                    <td>${app.formatDate(t.created_at)}</td>
                    <td><button class="btn btn-outline btn-sm" onclick="viewTransactionDetail('${t.id}')">Detail</button></td>
                  </tr>`).join('')
                : '<tr><td colspan="6"><div class="empty-state"><p>Belum ada transaksi</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat transaksi: ${error.message}</div>`;
  }
}

async function viewTransactionDetail(id) {
  try {
    const data = await app.request(`/transactions/${id}`);
    const t = data.data;

    app.showModal(`Detail Transaksi - ${t.invoice_number}`, `
      <div class="receipt">
        <div class="receipt-title">KASIR UMKM</div>
        <p>No: ${app.escapeHtml(t.invoice_number)}</p>
        <p>${app.formatDate(t.created_at)}</p>
        <hr class="receipt-divider">
        ${t.items.map(item => `
          <div class="receipt-row">
            <span>${app.escapeHtml(item.product_name)} x${item.quantity}</span>
            <span>${app.formatCurrency(item.subtotal)}</span>
          </div>
        `).join('')}
        <hr class="receipt-divider">
        <div class="receipt-row" style="font-weight:700;"><span>TOTAL</span><span>${app.formatCurrency(t.total)}</span></div>
        <div class="receipt-row"><span>Bayar</span><span>${app.formatCurrency(t.amount_paid)}</span></div>
        <div class="receipt-row"><span>Kembali</span><span>${app.formatCurrency(t.change_amount)}</span></div>
        <hr class="receipt-divider">
        <div class="receipt-footer">Terima kasih</div>
      </div>
    `);
  } catch (error) {
    app.showToast(error.message, 'error');
  }
}

async function loadCashierCustomers(container) {
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await app.request('/transactions/customers?limit=100');
    const customers = data.data;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Pelanggan</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddCustomerForm()">+ Tambah</button>
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

function showAddCustomerForm() {
  app.showModal('Tambah Pelanggan', `
    <form id="addCustomerForm">
      <div class="form-group">
        <label class="form-label">Nama</label>
        <input type="text" class="form-input" name="name" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor Telepon</label>
        <input type="text" class="form-input" name="phone">
      </div>
      <div id="addCustomerError" class="alert alert-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-full">Simpan</button>
    </form>
  `);

  document.getElementById('addCustomerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await app.request('/transactions/customers', { method: 'POST', body: data });
      app.showToast('Pelanggan berhasil ditambahkan', 'success');
      app.closeModal();
      loadPage('customers');
    } catch (error) {
      document.getElementById('addCustomerError').textContent = error.message;
      document.getElementById('addCustomerError').style.display = 'block';
    }
  });
}

async function loadCashierProfile(container) {
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
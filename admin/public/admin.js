// ── State ─────────────────────────────────────────────────────────────────────
let token = localStorage.getItem('pc_token');
let categories = [];
let pendingFiles = [];
let currentProductPage = 1;
const productsPerPage = 20;
let lastUserMessage = '';
let currentAiFile = null;
let currentAiFileMime = null;
let currentAiFileName = null;

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPrice(p) {
  if (p == null) return '—';
  return '₱' + Number(p).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { doLogout(); return null; }
  if (res.status === 204) return true;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = 'success') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function showApp() {
  const loginWrap = document.getElementById('loginWrap');
  const appWrap = document.getElementById('appWrap');
  if (loginWrap) loginWrap.style.display = 'none';
  if (appWrap) appWrap.style.display = 'grid';
  await loadDashboard();
}

function doLogout() {
  localStorage.removeItem('pc_token');
  token = null;
  const loginWrap = document.getElementById('loginWrap');
  const appWrap = document.getElementById('appWrap');
  if (appWrap) appWrap.style.display = 'none';
  if (loginWrap) loginWrap.style.display = 'flex';
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar .nav-link[data-section]').forEach(a => a.classList.remove('active'));
  const targetSection = document.getElementById(`sec-${name}`);
  if (targetSection) targetSection.classList.add('active');
  const targetLink = document.querySelector(`.sidebar .nav-link[data-section="${name}"]`);
  if (targetLink) targetLink.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'products') loadProducts();
  if (name === 'categories') loadCategories();
  if (name === 'promotions') loadPromotions();
  if (name === 'reviews') loadReviews();
  if (name === 'settings' || name === 'ai') loadSettings();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await api('GET', '/api/stats');
    if (!stats) return;
    const elP = document.getElementById('stat-products');
    const elC = document.getElementById('stat-categories');
    const elPr = document.getElementById('stat-promotions');
    const elR = document.getElementById('stat-reviews');
    if (elP) elP.textContent = stats.products;
    if (elC) elC.textContent = stats.categories;
    if (elPr) elPr.textContent = stats.promotions;
    if (elR) elR.textContent = stats.reviews;

    const gwText = document.getElementById('dashGwText');
    if (gwText) {
      if (stats.gateway_connected) {
        gwText.innerHTML = `
          <div style="display:flex;align-items:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="color:var(--success);margin-right:0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span style="color:var(--success);font-weight:600;margin-right:0.5rem;">Connected</span>
            — Your products are visible to AI shoppers on the Prompt Commerce network.
          </div>`;
      } else {
        gwText.innerHTML = `
          <div style="display:flex;align-items:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="color:var(--warning);margin-right:0.5rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span style="color:var(--warning);font-weight:600;margin-right:0.5rem;">Not connected</span>
            — Paste your platform key in Settings to go live.
          </div>`;
      }
    }
  } catch (err) {
    console.error('loadDashboard error:', err);
  }
}

// ── Products ──────────────────────────────────────────────────────────────────
async function loadProducts(page = 1) {
  currentProductPage = page;
  const q = document.getElementById('productSearch')?.value || '';
  const active = document.getElementById('productFilter')?.value || '';
  let url = `/api/products?page=${currentProductPage}&limit=${productsPerPage}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  if (active !== '') url += `&active=${active}`;

  try {
    const res = await api('GET', url);
    const products = res?.products ?? [];
    const totalCount = res?.totalCount ?? 0;

    const tbody = document.getElementById('productsTbody');
    if (!tbody) return;

    if (!products?.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No products found.</div></td></tr>`;
      const pagEl = document.getElementById('productPagination');
      if (pagEl) pagEl.style.display = 'none';
      return;
    }

    const pagEl = document.getElementById('productPagination');
    if (pagEl) {
      pagEl.style.display = 'flex';
      const infoEl = document.getElementById('productPageInfo');
      if (infoEl) infoEl.textContent = `Page ${currentProductPage} of ${Math.ceil(totalCount / productsPerPage) || 1}`;
      const btnPrev = document.getElementById('btnPrevPage');
      const btnNext = document.getElementById('btnNextPage');
      if (btnPrev) btnPrev.disabled = (currentProductPage <= 1);
      if (btnNext) btnNext.disabled = (currentProductPage >= Math.ceil(totalCount / productsPerPage));
    }

    tbody.innerHTML = products.map(p => {
      const images = p.images ? JSON.parse(p.images) : [];
      const thumb = images.length > 0 ? images[0] : '';
      return `
  <tr>
    <td>
      ${thumb ? `<img src="${thumb}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border);" />` : `<div style="width:40px;height:40px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.7rem;">No img</div>`}
    </td>
    <td>
      <strong>${esc(p.title)}</strong>
      ${p.description ? `<br/><span style="color:var(--muted);font-size:0.78rem;">${esc(p.description).slice(0, 60)}${p.description.length > 60 ? '…' : ''}</span>` : ''}
    </td>
    <td style="color:var(--muted);font-size:0.8rem;">${esc(p.sku) || '—'}</td>
    <td style="font-size:0.85rem;">${esc(p.category_name) || '—'}</td>
    <td style="font-size:0.88rem;">${fmtPrice(p.price)}</td>
    <td style="font-size:0.88rem;">${p.stock_quantity ?? 0}</td>
    <td>${p.active ? '<span class="badge badge-success"><i data-lucide="check-circle" class="icon" style="width:1em;height:1em;margin-right:0.25rem;"></i> Active</span>' : '<span class="badge badge-danger"><i data-lucide="alert-triangle" class="icon" style="width:1em;height:1em;margin-right:0.25rem;"></i> Inactive</span>'}</td>
    <td>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id}, '${esc(p.title)}')">Hide</button>
      </div>
    </td>
  </tr>
  `}).join('');
    lucide.createIcons();
  } catch (err) {
    console.error('loadProducts error:', err);
  }
}

function changeProductPage(delta) {
  loadProducts(currentProductPage + delta);
}

function openNewProduct() {
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('pTitle').value = '';
  document.getElementById('pSku').value = '';
  document.getElementById('pDesc').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pStock').value = '0';
  document.getElementById('pTags').value = '';
  document.getElementById('pActive').value = '1';
  document.getElementById('pImagesContainer').innerHTML = '';
  pendingFiles = [];
  document.getElementById('productModalError').style.display = 'none';
  fillCategorySelect('pCategory', null);
  document.getElementById('productModal').style.display = 'flex';
}

async function openEditProduct(id) {
  const p = await api('GET', `/api/products/${id}`);
  if (!p) return;
  document.getElementById('productId').value = p.id;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('pTitle').value = p.title ?? '';
  document.getElementById('pSku').value = p.sku ?? '';
  document.getElementById('pDesc').value = p.description ?? '';
  document.getElementById('pPrice').value = p.price ?? '';
  document.getElementById('pStock').value = p.stock_quantity ?? '0';
  const tags = p.tags ? JSON.parse(p.tags) : [];
  document.getElementById('pTags').value = tags.join(', ');
  document.getElementById('pActive').value = p.active ? '1' : '0';
  document.getElementById('productModalError').style.display = 'none';
  pendingFiles = [];

  const images = p.images ? JSON.parse(p.images) : [];
  renderProductImages(images);

  fillCategorySelect('pCategory', p.category_id);
  document.getElementById('productModal').style.display = 'flex';
}

function fillCategorySelect(selectId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— None —</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id == selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderProductImages(images) {
  const container = document.getElementById('pImagesContainer');
  if (!container) return;
  container.innerHTML = images.map((url, index) => `
    <div class="img-manage-item">
      <img src="${url}" />
      <button class="delete-img" onclick="removeImage(${index})">×</button>
    </div>
  `).join('');
}

function removeImage(index) {
  const container = document.getElementById('pImagesContainer');
  if (!container) return;
  const items = Array.from(container.querySelectorAll('.img-manage-item'));
  if (items[index]) items[index].remove();
}

async function deleteProduct(id, name) {
  if (!confirm(`Hide "${name}" from customers? (You can re-activate it later)`)) return;
  await api('DELETE', `/api/products/${id}`);
  showToast('Product hidden from customers.');
  loadProducts();
}

// ── Categories ────────────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    categories = await api('GET', '/api/categories') ?? [];
    const tbody = document.getElementById('categoriesTbody');
    if (!tbody) return;
    if (!categories.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No categories yet.</div></td></tr>`;
      return;
    }
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);
    tbody.innerHTML = categories.map(c => `
<tr>
  <td><strong>${esc(c.name)}</strong></td>
  <td style="color:var(--muted);font-size:0.85rem;">${c.parent_id ? esc(catMap[c.parent_id]) : '—'}</td>
  <td style="font-size:0.88rem;">${c.product_count ?? 0}</td>
  <td style="color:var(--muted);font-size:0.82rem;">${fmtDate(c.created_at)}</td>
  <td>
    <div class="actions" style="justify-content:flex-end;">
      <button class="btn btn-secondary btn-sm" onclick="openEditCategory(${c.id})" title="Edit Detail">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin:0;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
      <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id}, '${esc(c.name)}')" title="Delete Category">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin:0;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  </td>
</tr>
`).join('');
  } catch (err) {
    console.error('loadCategories error:', err);
  }
}

async function openEditCategory(id) {
  const c = await api('GET', `/api/categories/${id}`);
  if (!c) return;
  document.getElementById('catId').value = c.id;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('catName').value = c.name;
  document.getElementById('categoryModalError').style.display = 'none';

  const sel = document.getElementById('catParent');
  if (sel) {
    sel.innerHTML = '<option value="">— None (top-level) —</option>';
    categories.forEach(cat => {
      if (cat.id == c.id) return;
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (cat.id == c.parent_id) opt.selected = true;
      sel.appendChild(opt);
    });
  }
  document.getElementById('categoryModal').style.display = 'flex';
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"? Products in this category will become uncategorised.`)) return;
  await api('DELETE', `/api/categories/${id}`);
  showToast('Category deleted.');
  loadCategories();
}

// ── Promotions ────────────────────────────────────────────────────────────────
async function loadPromotions() {
  try {
    const promos = await api('GET', '/api/promotions') ?? [];
    const tbody = document.getElementById('promosTbody');
    if (!tbody) return;
    if (!promos.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No promotions yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = promos.map(p => `
<tr>
  <td><strong>${esc(p.title)}</strong></td>
  <td style="font-size:0.85rem;color:var(--muted);">${p.product_title ? esc(p.product_title) : 'All products'}</td>
  <td style="font-family:monospace;font-size:0.85rem;color:var(--success);">${p.voucher_code ? esc(p.voucher_code) : '—'}</td>
  <td style="font-size:0.88rem;">
    ${p.discount_type === 'percentage' ? `${p.discount_value}%` : fmtPrice(p.discount_value)} off
  </td>
  <td style="font-size:0.78rem;color:var(--muted);">
    ${p.start_date ? fmtDate(p.start_date) : ''}${p.start_date && p.end_date ? ' – ' : ''}${p.end_date ? fmtDate(p.end_date) : ''}${!p.start_date && !p.end_date ? 'No dates' : ''}
  </td>
  <td>${p.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
  <td>
    <div class="actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditPromo(${p.id})">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deletePromo(${p.id}, '${esc(p.title)}')">Delete</button>
    </div>
  </td>
</tr>
`).join('');
  } catch (err) {
    console.error('loadPromotions error:', err);
  }
}

async function openPromoModal(promo) {
  const products = await api('GET', '/api/products?active=1') ?? [];
  const sel = document.getElementById('promoProduct');
  if (sel) {
    sel.innerHTML = '<option value="">All products</option>';
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title;
      if (promo && p.id == promo.product_id) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  document.getElementById('promoId').value = promo?.id ?? '';
  document.getElementById('promoModalTitle').textContent = promo ? 'Edit Promotion' : 'Add Promotion';
  document.getElementById('promoTitle').value = promo?.title ?? '';
  document.getElementById('promoVoucher').value = promo?.voucher_code ?? '';
  document.getElementById('promoType').value = promo?.discount_type ?? 'percentage';
  document.getElementById('promoValue').value = promo?.discount_value ?? '';
  document.getElementById('promoStart').value = promo?.start_date?.slice(0, 10) ?? '';
  document.getElementById('promoEnd').value = promo?.end_date?.slice(0, 10) ?? '';
  document.getElementById('promoActive').value = (promo?.active ?? 1) ? '1' : '0';
  document.getElementById('promoModalError').style.display = 'none';
  document.getElementById('promoModal').style.display = 'flex';
}

async function openEditPromo(id) {
  const promos = await api('GET', '/api/promotions') ?? [];
  const promo = promos.find(p => p.id === id);
  if (promo) openPromoModal(promo);
}

async function deletePromo(id, name) {
  if (!confirm(`Delete promotion "${name}"?`)) return;
  await api('DELETE', `/api/promotions/${id}`);
  showToast('Promotion deleted.');
  loadPromotions();
}

// ── Reviews ───────────────────────────────────────────────────────────────────
async function loadReviews() {
  try {
    const reviews = await api('GET', '/api/reviews') ?? [];
    const tbody = document.getElementById('reviewsTbody');
    if (!tbody) return;
    if (!reviews.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No reviews yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = reviews.map(r => {
      const fullStars = '<i data-lucide="star" class="icon star-icon text-warning" style="fill:currentColor;"></i>'.repeat(r.rating);
      const emptyStars = '<i data-lucide="star" class="icon star-icon" style="opacity:0.25;"></i>'.repeat(5 - r.rating);
      return `
<tr>
  <td class="font-sm">${esc(r.customer_name) || '<span class="text-muted">Anonymous</span>'}</td>
  <td class="text-muted font-sm">${esc(r.product_title) || '—'}</td>
  <td><div class="review-stars">${fullStars}${emptyStars}</div></td>
  <td class="font-sm" style="max-width:260px;">${esc(r.comment) || '—'}</td>
  <td class="text-muted font-xs">${fmtDate(r.created_at)}</td>
  <td>
    <button class="btn btn-danger btn-sm" onclick="deleteReview(${r.id})">Delete</button>
  </td>
</tr>
`;
    }).join('');
    lucide.createIcons();
  } catch (err) {
    console.error('loadReviews error:', err);
  }
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  await api('DELETE', `/api/reviews/${id}`);
  showToast('Review deleted.');
  loadReviews();
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const settings = await api('GET', '/api/settings');
    if (!settings) return;
    window.pc_settings = settings;

    const isSet = settings.gateway_key_set;
    const elStatus = document.getElementById('gwKeyStatus');
    if (elStatus) {
      elStatus.innerHTML = isSet
        ? `<div class="key-status-connected" style="display:flex;align-items:center;gap:0.5rem;">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="color:var(--success);margin:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
             Connected to gateway
           </div>`
        : `<div class="key-status-missing" style="display:flex;align-items:center;gap:0.5rem;">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="color:var(--warning);margin:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
             No platform key configured
           </div>`;
    }

    const elInstr = document.getElementById('gwKeyInstructions');
    const elNote = document.getElementById('gwKeyConnectedNote');
    if (elInstr) elInstr.style.display = isSet ? 'none' : 'block';
    if (elNote) elNote.style.display = isSet ? 'block' : 'none';

    const elInput = document.getElementById('gatewayKeyInput');
    if (elInput) {
      elInput.value = '';
      elInput.type = 'password';
      elInput.placeholder = isSet ? 'Paste new key to replace current one…' : 'Paste your platform key here…';
    }
    const gatewayKeyToggle = document.getElementById('gatewayKeyToggle');
    if (gatewayKeyToggle) {
      gatewayKeyToggle.innerHTML = '<i data-lucide="eye" class="eye-icon" style="width:20px;height:20px;"></i>';
      lucide.createIcons();
    }

    const elBase = document.getElementById('baseUrlInput');
    if (elBase) elBase.value = settings.base_url || '';

    // AI Connections
    const serperStatus = document.getElementById('serperStatus');
    if (serperStatus) {
      if (settings.serper_api_key_set) {
        serperStatus.innerHTML = '<span style="color:var(--accent);">✓ Connected</span>';
        document.getElementById('btnConnectSerper').textContent = 'Reconnect';
      } else {
        serperStatus.textContent = 'Not Connected';
        serperStatus.style.color = 'var(--danger)';
        document.getElementById('btnConnectSerper').textContent = 'Connect';
      }
    }

    const geminiStatus = document.getElementById('geminiStatus');
    const btnConnectGoogle = document.getElementById('btnConnectGoogle');
    const claudeStatus = document.getElementById('claudeStatus');
    const btnConnectClaude = document.getElementById('btnConnectClaude');
    const modelGroup = document.getElementById('aiModelGroup');
    const accountHint = document.getElementById('geminiAccountHint');

    const geminiConnected = !!(settings.google_access_token || settings.gemini_api_key_set);
    const claudeConnected = !!settings.claude_api_key_set;
    const anyConnected = geminiConnected || claudeConnected;

    if (geminiStatus) {
      if (geminiConnected) {
        geminiStatus.innerHTML = '<span style="color:var(--accent);">✓ Connected</span>';
        if (btnConnectGoogle) btnConnectGoogle.textContent = 'Reconnect';
        if (accountHint) accountHint.textContent = settings.google_account_email ? `(${settings.google_account_email})` : '';
      } else {
        geminiStatus.textContent = 'Not Connected';
        geminiStatus.style.color = 'var(--danger)';
        if (btnConnectGoogle) btnConnectGoogle.textContent = 'Connect';
        if (accountHint) accountHint.textContent = '';
      }
    }

    if (claudeStatus) {
      if (claudeConnected) {
        claudeStatus.innerHTML = '<span style="color:var(--accent);">✓ Connected</span>';
        if (btnConnectClaude) btnConnectClaude.textContent = 'Reconnect';
      } else {
        claudeStatus.textContent = 'Not Connected';
        claudeStatus.style.color = 'var(--danger)';
        if (btnConnectClaude) btnConnectClaude.textContent = 'Connect';
      }
    }

    if (anyConnected) fetchAllAiModels(geminiConnected, claudeConnected, settings.ai_model);

    const overlay = document.getElementById('aiConnectOverlay');
    if (overlay) overlay.style.display = anyConnected ? 'none' : 'flex';
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

async function fetchAllAiModels(geminiConnected, claudeConnected, savedModel) {
  try {
    const allModels = [];
    if (geminiConnected) {
      try {
        const data = await api('GET', '/api/ai/models');
        if (data.models && data.models.length > 0) {
          allModels.push(...data.models.map(m => ({ ...m, group: 'Google Gemini' })));
        }
      } catch (e) { console.warn('Could not fetch Gemini models', e); }
    }
    if (claudeConnected) {
      try {
        const data = await api('GET', '/api/ai/models/claude');
        if (data.models && data.models.length > 0) {
          allModels.push(...data.models.map(m => ({ ...m, group: 'Anthropic Claude' })));
        }
      } catch (e) { console.warn('Could not fetch Claude models', e); }
    }
    if (allModels.length === 0) return;

    const select = document.getElementById('aiModelSelect');
    if (!select) return;
    
    // Show/hide selector based on connection
    select.style.display = 'block';
    
    // If no model saved, try to favor the latest Flash
    let targetModel = savedModel || select.value;
    if (!targetModel) {
      const flash = allModels.find(m => m.id.includes('2.5-flash')) || 
                    allModels.find(m => m.id.includes('2.0-flash')) ||
                    allModels.find(m => m.id === 'gemini-flash-latest') ||
                    allModels.find(m => m.id.includes('1.5-flash'));
      if (flash) targetModel = flash.id;
    }
    
    let found = allModels.find(m => m.id === targetModel);
    const finalModel = found ? targetModel : allModels[0].id;

    const groups = {};
    allModels.forEach(m => {
      if (!groups[m.group]) groups[m.group] = [];
      groups[m.group].push(m);
    });

    select.innerHTML = Object.entries(groups).map(([groupName, models]) =>
      `<optgroup label="${groupName}">${models.map(m =>
        `<option value="${m.id}" ${m.id === finalModel ? 'selected' : ''}>${m.name}</option>`
      ).join('')}</optgroup>`
    ).join('');

    if (finalModel !== targetModel) {
      await api('PUT', '/api/settings', { ai_model: finalModel });
      if (window.pc_settings) window.pc_settings.ai_model = finalModel;
    }
  } catch (err) {
    console.error('Failed to fetch models:', err);
    const select = document.getElementById('aiModelSelect');
    if (select) select.style.display = 'none';
  }
}

async function fetchAccountInfo() {
  try {
    const data = await api('GET', '/api/ai/account');
    if (data.connected) {
      const elHint = document.getElementById('geminiAccountHint');
      if (elHint) elHint.textContent = `(${data.account_hint})`;
    }
  } catch (err) {
    console.error('Failed to fetch account info:', err);
  }
}

async function clearAiSettings() {
  if (!confirm('Are you sure you want to disconnect and clear all AI settings?')) return;
  await api('PUT', '/api/settings', {
    gemini_api_key: '',
    claude_api_key: '',
    serper_api_key: '',
  });
  showToast('AI settings cleared.');
  loadSettings();
}

let currentPlatform = '';
function openConnectModal(platform) {
  currentPlatform = platform;
  const modal = document.getElementById('connectModal');
  const title = document.getElementById('connectModalTitle');
  const desc = document.getElementById('connectModalDesc');
  const link = document.getElementById('platformLink');
  if (!modal) return;
  
  if (platform === 'google') {
    if (title) title.textContent = 'Connect to Google Gemini';
    if (desc) desc.textContent = 'Connect your account to power the assistant.';
    if (link) link.href = 'https://aistudio.google.com/app/apikey';
  } else if (platform === 'claude') {
    if (title) title.textContent = 'Connect to Anthropic Claude';
    if (desc) desc.textContent = 'Use your Anthropic account to power the assistant.';
    if (link) link.href = 'https://console.anthropic.com/settings/keys';
  } else if (platform === 'serper') {
    if (title) title.textContent = 'Connect Web Search (Serper)';
    if (desc) desc.textContent = 'Get a free API key from Serper.dev for web search.';
    if (link) link.href = 'https://serper.dev';
  }
  
  const elInp = document.getElementById('platformKeyInput');
  if (elInp) elInp.value = '';
  modal.style.display = 'flex';
}

async function downloadClaudeSetup(platform) {
  const s = window.pc_settings || {};
  if (!s.base_url || !s.gateway_key_set) {
    const elMiss = document.getElementById('claudeDesktopMissingNote');
    if (elMiss) elMiss.style.display = 'block';
    const elCard = document.getElementById('claudeDesktopCard');
    if (elCard) elCard.scrollIntoView({ behavior: 'smooth' });
    showToast('Please save your Base URL and Gateway Key first.', 'error');
    return;
  }
  const elMiss = document.getElementById('claudeDesktopMissingNote');
  if (elMiss) elMiss.style.display = 'none';
  const endpoint = platform === 'mac' ? '/api/settings/claude-setup-mac' : '/api/settings/claude-setup-win';
  const filename = platform === 'mac' ? 'add_mcp_mac.sh' : 'add_mcp_win.bat';
  try {
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const err = await res.json(); showToast(err.error || 'Download failed.', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  }
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// ── Password Visibility Toggles ──────────────────────────────────────────────
function setupPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;

  toggle.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text';
      toggle.innerHTML = '<i data-lucide="eye-off" class="eye-icon" style="width:20px;height:20px;"></i>';
    } else {
      input.type = 'password';
      toggle.innerHTML = '<i data-lucide="eye" class="eye-icon" style="width:20px;height:20px;"></i>';
    }
    lucide.createIcons();
  });
}

// ── AI Chat ──────────────────────────────────────────────────────────────────
let aiHistory = [];

function aiQuickAction(text) {
  const inp = document.getElementById('aiInput');
  if (inp) {
    inp.value = text;
    sendAiMessage();
  }
}

function clearAiChat() {
  if (!confirm('Clear all chat history?')) return;
  aiHistory = [];
  const history = document.getElementById('aiChatHistory');
  if (history) {
    history.innerHTML = '';
    showAiWelcome();
  }
}

function showAiWelcome() {
  const history = document.getElementById('aiChatHistory');
  if (!history) return;
  history.innerHTML = `
    <div id="aiWelcome" class="ai-welcome">
      <div class="icon-circle icon-circle-md">
        <i data-lucide="help-circle" class="icon text-accent" style="width:32px;height:32px;"></i>
      </div>
      <h2>How can I help you today?</h2>
      <p>I can manage categories, search products, or even update stock levels using natural language.</p>
      <div class="ai-quick-actions">
        <button class="btn btn-secondary btn-sm ai-quick-btn" type="button" onclick="aiQuickAction('Add toys categories')">"Add toys categories..."</button>
        <button class="btn btn-secondary btn-sm ai-quick-btn" type="button" onclick="aiQuickAction('Search cheap products')">"Find cheap products..."</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

async function sendAiMessage() {
  const input = document.getElementById('aiInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  lastUserMessage = text;
  input.value = '';
  const welcome = document.getElementById('aiWelcome');
  if (welcome) welcome.remove();

  appendChatMessage('user', text);
  const thinkingId = appendThinkingIndicator();

  const body = { message: text, history: aiHistory };
  if (currentAiFile) {
    body.file_data = currentAiFile;
    body.file_mime = currentAiFileMime;
    body.file_name = currentAiFileName;
  }

  try {
    const res = await api('POST', '/api/ai/chat', body);
    removeThinkingIndicator(thinkingId);
    if (res) {
      aiHistory = res.history;
      appendChatMessage('assistant', res.text);
      clearAiFile();
    }
  } catch (err) {
    removeThinkingIndicator(thinkingId);
    let errorMsg = err.message;
    let showSwitch = false;
    if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
      errorMsg = `### ⚠️ Quota Limit Reached on ${window.pc_settings?.ai_model || 'this model'}
Google often restricts their **Experimental Models (like Gemini 2.0)** on free accounts. 
**Recommended Action:** Switch to **Gemini 1.5 Flash**.`;
      showSwitch = true;
    }
    appendChatMessage('assistant', errorMsg, true);
    if (showSwitch) {
      const history = document.getElementById('aiChatHistory');
      const div = document.createElement('div');
      div.style.textAlign = 'center';
      div.style.marginTop = '-0.5rem';
      div.style.marginBottom = '1rem';
      div.innerHTML = `<button class="btn btn-secondary btn-sm" type="button" onclick="autoSwitchModel('gemini-1.5-flash')">Switch to Gemini 1.5 Flash</button>`;
      if (history) {
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
      }
    }
  }
}

async function autoSwitchModel(modelId) {
  await api('PUT', '/api/settings', { ai_model: modelId });
  if (window.pc_settings) window.pc_settings.ai_model = modelId;
  showToast('Switched to ' + modelId);
  await loadSettings();
  if (lastUserMessage) {
    appendChatMessage('assistant', `Switched to **${modelId}**. Retrying your request...`);
    setTimeout(() => {
      const inp = document.getElementById('aiInput');
      if (inp) {
        inp.value = lastUserMessage;
        sendAiMessage();
      }
    }, 500);
  }
}

function appendChatMessage(role, content, isError = false) {
  const history = document.getElementById('aiChatHistory');
  if (!history) return;
  const div = document.createElement('div');
  div.className = `ai-bubble ai-bubble-${role} ${isError ? 'ai-bubble-error' : ''}`;
  let formatted = esc(content)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\* (.*?)/g, '<br/>• $1')
    .replace(/\n\d+\. (.*?)/g, '<br/>$1')
    .replace(/\n/g, '<br/>');
  const label = role === 'user' ? 'You' : 'Assistant';
  div.innerHTML = `<span class="role-label">${label}</span>${formatted}`;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
}

function appendThinkingIndicator() {
  const history = document.getElementById('aiChatHistory');
  if (!history) return 'no-history';
  const id = 'thinking-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'ai-bubble ai-bubble-assistant ai-thinking';
  div.innerHTML = `<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>`;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return id;
}

function removeThinkingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function handleAiFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  currentAiFileName = file.name;
  currentAiFileMime = file.type;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    currentAiFile = event.target.result.split(',')[1]; // Get base64 part
    
    const previewImg = document.getElementById('aiPreviewImg');
    const previewDoc = document.getElementById('aiPreviewDoc');
    const previewFilename = document.getElementById('aiPreviewFilename');
    
    if (file.type.startsWith('image/')) {
      previewImg.src = event.target.result;
      previewImg.style.display = 'block';
      previewDoc.style.display = 'none';
    } else {
      previewImg.style.display = 'none';
      previewDoc.style.display = 'flex';
    }
    
    if (previewFilename) previewFilename.textContent = file.name;
    const previewArea = document.getElementById('aiFilePreview');
    if (previewArea) previewArea.style.display = 'flex';
    lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function clearAiFile() {
  currentAiFile = null;
  currentAiFileMime = null;
  currentAiFileName = null;
  const previewArea = document.getElementById('aiFilePreview');
  if (previewArea) previewArea.style.display = 'none';
  const uploadInput = document.getElementById('aiFileUpload');
  if (uploadInput) uploadInput.value = '';
}

// ── Event Listeners ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (token) {
    try { await showApp(); } catch(e) { console.error('Initial showApp failed:', e); }
  }
  lucide.createIcons();
  
  setupPasswordToggle('lPass', 'lPassToggle');
  setupPasswordToggle('pwCurrent', 'pwCurrentToggle');
  setupPasswordToggle('pwNew', 'pwNewToggle');
  setupPasswordToggle('pwConfirm', 'pwConfirmToggle');
  setupPasswordToggle('platformKeyInput', 'platformKeyToggle');
  setupPasswordToggle('gatewayKeyInput', 'gatewayKeyToggle');

  // ── Settings Listeners ───────────────────────────────────────────────────
  const btnSaveBase = document.getElementById('saveBaseUrlBtn');
  if (btnSaveBase) {
    btnSaveBase.addEventListener('click', async () => {
      const urlEl = document.getElementById('baseUrlInput');
      const url = urlEl ? urlEl.value.trim() : '';
      if (!url) return showToast('Please enter a Base URL.', 'error');
      try {
        await api('PUT', '/api/settings', { base_url: url });
        showToast('Base URL updated.');
        await loadSettings();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const btnSaveGw = document.getElementById('saveGwKeyBtn');
  if (btnSaveGw) {
    btnSaveGw.addEventListener('click', async () => {
      const inp = document.getElementById('gatewayKeyInput');
      const key = inp ? inp.value.trim() : '';
      if (!key) return showToast('Please paste a platform key first.', 'error');
      const msg = document.getElementById('gwKeySavingMsg');
      if (msg) msg.style.display = 'inline';
      try {
        await api('PUT', '/api/settings', { gateway_key: key });
        if (msg) msg.style.display = 'none';
        if (inp) inp.value = '';
        showToast('Gateway key saved! Your store is now connected.');
        await loadSettings();
        await loadDashboard();
      } catch (err) {
        if (msg) msg.style.display = 'none';
        showToast(err.message, 'error');
      }
    });
  }

  // ── Other Global Listeners ───────────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      if (errEl) errEl.style.display = 'none';
      try {
        const u = document.getElementById('lUser')?.value;
        const p = document.getElementById('lPass')?.value;
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Login failed.'); }
        const data = await res.json();
        token = data.access_token;
        localStorage.setItem('pc_token', token);
        await showApp();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  document.querySelectorAll('.nav-link[data-section]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(el.dataset.section);
    });
  });

  document.getElementById('productSearch')?.addEventListener('input', () => loadProducts(1));
  document.getElementById('productFilter')?.addEventListener('change', () => loadProducts(1));
  document.getElementById('btnPrevPage')?.addEventListener('click', () => changeProductPage(-1));
  document.getElementById('btnNextPage')?.addEventListener('click', () => changeProductPage(1));
  document.getElementById('btnNewProduct')?.addEventListener('click', openNewProduct);
  
  const pCancel = document.getElementById('productModalCancel');
  if (pCancel) pCancel.addEventListener('click', () => {
    const m = document.getElementById('productModal');
    if (m) m.style.display = 'none';
  });

  const pSave = document.getElementById('productModalSave');
  if (pSave) {
    pSave.addEventListener('click', async () => {
      const id = document.getElementById('productId')?.value;
      const errEl = document.getElementById('productModalError');
      if (errEl) errEl.style.display = 'none';
      const title = document.getElementById('pTitle')?.value.trim();
      if (!title) { if (errEl) { errEl.textContent = 'Product name is required.'; errEl.style.display = 'block'; } return; }
      const tagsRaw = document.getElementById('pTags')?.value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      const body = {
        title,
        sku: document.getElementById('pSku')?.value.trim() || null,
        description: document.getElementById('pDesc')?.value.trim() || null,
        category_id: document.getElementById('pCategory')?.value || null,
        price: document.getElementById('pPrice')?.value ? Number(document.getElementById('pPrice').value) : null,
        stock_quantity: document.getElementById('pStock')?.value ? Number(document.getElementById('pStock').value) : 0,
        images: Array.from(document.getElementById('pImagesContainer')?.querySelectorAll('img') || [])
          .map(img => img.src)
          .filter(src => !src.startsWith('blob:'))
          .map(src => src.replace(window.location.origin, '')),
        tags,
        active: document.getElementById('pActive')?.value === '1',
      };
      try {
        let finalId = id;
        if (id) {
          await api('PUT', `/api/products/${id}`, body);
          showToast('Product updated.');
        } else {
          const res = await api('POST', '/api/products', body);
          finalId = res.id;
          showToast('Product added.');
        }
        const pendingItems = Array.from(document.querySelectorAll('.img-manage-item.pending-upload'));
        if (pendingItems.length > 0 && finalId) {
          for (const item of pendingItems) {
            const img = item.querySelector('img');
            const idx = parseInt(img.dataset.pendingIdx, 10);
            const file = pendingFiles[idx];
            if (!file) continue;
            const formData = new FormData();
            formData.append('image', file);
            await fetch(`/api/products/${finalId}/images`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('pc_token')}` },
              body: formData
            });
          }
        }
        const m = document.getElementById('productModal');
        if (m) m.style.display = 'none';
        await loadProducts();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      }
    });
  }

  const imgUpload = document.getElementById('pImageUpload');
  if (imgUpload) {
    imgUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const id = document.getElementById('productId')?.value;
      if (!id) {
        const url = URL.createObjectURL(file);
        pendingFiles.push(file);
        const container = document.getElementById('pImagesContainer');
        if (container) {
          const div = document.createElement('div');
          div.className = 'img-manage-item pending-upload';
          div.innerHTML = `<img src="${url}" data-pending-idx="${pendingFiles.length - 1}" /><button class="delete-img" onclick="this.parentElement.remove()">×</button>`;
          container.appendChild(div);
        }
      } else {
        const formData = new FormData();
        formData.append('image', file);
        try {
          const res = await fetch(`/api/products/${id}/images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('pc_token')}` },
            body: formData
          });
          const data = await res.json();
          if (data.url) {
            const container = document.getElementById('pImagesContainer');
            if (container) {
              const div = document.createElement('div');
              div.className = 'img-manage-item';
              div.innerHTML = `<img src="${data.url}" /><button class="delete-img" onclick="this.parentElement.remove()">×</button>`;
              container.appendChild(div);
            }
          }
        } catch (err) {
          alert("Upload failed: " + err.message);
        }
      }
      e.target.value = '';
    });
  }

  document.getElementById('btnNewCategory')?.addEventListener('click', () => {
    const elId = document.getElementById('catId');
    const elTitle = document.getElementById('categoryModalTitle');
    const elName = document.getElementById('catName');
    const elErr = document.getElementById('categoryModalError');
    if (elId) elId.value = '';
    if (elTitle) elTitle.textContent = 'Add Category';
    if (elName) elName.value = '';
    if (elErr) elErr.style.display = 'none';
    const sel = document.getElementById('catParent');
    if (sel) {
      sel.innerHTML = '<option value="">— None (top-level) —</option>';
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    }
    const m = document.getElementById('categoryModal');
    if (m) m.style.display = 'flex';
  });

  document.getElementById('categoryModalCancel')?.addEventListener('click', () => {
    const m = document.getElementById('categoryModal');
    if (m) m.style.display = 'none';
  });

  const cSave = document.getElementById('categoryModalSave');
  if (cSave) {
    cSave.addEventListener('click', async () => {
      const errEl = document.getElementById('categoryModalError');
      if (errEl) errEl.style.display = 'none';
      const id = document.getElementById('catId')?.value;
      const name = document.getElementById('catName')?.value.trim();
      if (!name) { if (errEl) { errEl.textContent = 'Category name is required.'; errEl.style.display = 'block'; } return; }
      try {
        const body = { name, parent_id: document.getElementById('catParent')?.value || null };
        if (id) {
          await api('PUT', `/api/categories/${id}`, body);
          showToast('Category updated.');
        } else {
          await api('POST', '/api/categories', body);
          showToast('Category added.');
        }
        const m = document.getElementById('categoryModal');
        if (m) m.style.display = 'none';
        await loadCategories();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      }
    });
  }

  document.getElementById('btnNewPromo')?.addEventListener('click', () => openPromoModal(null));
  document.getElementById('promoModalCancel')?.addEventListener('click', () => {
    const m = document.getElementById('promoModal');
    if (m) m.style.display = 'none';
  });

  const prSave = document.getElementById('promoModalSave');
  if (prSave) {
    prSave.addEventListener('click', async () => {
      const id = document.getElementById('promoId')?.value;
      const errEl = document.getElementById('promoModalError');
      if (errEl) errEl.style.display = 'none';
      const title = document.getElementById('promoTitle')?.value.trim();
      const val = document.getElementById('promoValue')?.value;
      const body = {
        title,
        product_id: document.getElementById('promoProduct')?.value || null,
        voucher_code: document.getElementById('promoVoucher')?.value.trim().toUpperCase() || null,
        discount_type: document.getElementById('promoType')?.value,
        discount_value: val ? Number(val) : 0,
        start_date: document.getElementById('promoStart')?.value || null,
        end_date: document.getElementById('promoEnd')?.value || null,
        active: document.getElementById('promoActive')?.value === '1',
      };
      if (!body.title) { if (errEl) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; } return; }
      if (!body.discount_value) { if (errEl) { errEl.textContent = 'Discount value is required.'; errEl.style.display = 'block'; } return; }
      try {
        if (id) {
          await api('PUT', `/api/promotions/${id}`, body);
          showToast('Promotion updated.');
        } else {
          await api('POST', '/api/promotions', body);
          showToast('Promotion created.');
        }
        const m = document.getElementById('promoModal');
        if (m) m.style.display = 'none';
        await loadPromotions();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      }
    });
  }

  document.getElementById('btnCancelConnect')?.addEventListener('click', () => {
    const m = document.getElementById('connectModal');
    if (m) m.style.display = 'none';
  });

  const btnSaveConn = document.getElementById('btnSaveConnection');
  if (btnSaveConn) {
    btnSaveConn.addEventListener('click', async () => {
      const inp = document.getElementById('platformKeyInput');
      const key = inp ? inp.value.trim() : '';
      if (!key) return alert('Please paste your security key.');
      try {
        const body = {};
        if (currentPlatform === 'google') body.gemini_api_key = key;
        else if (currentPlatform === 'claude') body.claude_api_key = key;
        else if (currentPlatform === 'serper') body.serper_api_key = key;

        await api('PUT', '/api/settings', body);
        showToast(`Connected to ${currentPlatform}.`);
        const m = document.getElementById('connectModal');
        if (m) m.style.display = 'none';
        await loadSettings();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  document.getElementById('aiModelSelect')?.addEventListener('change', async (e) => {
    await api('PUT', '/api/settings', { ai_model: e.target.value });
    showToast('AI Model updated.');
    await loadSettings();
  });

  document.getElementById('btnAiSend')?.addEventListener('click', sendAiMessage);
  document.getElementById('aiInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAiMessage(); });

  ['productModal', 'categoryModal', 'promoModal', 'connectModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
      });
    }
  });
});

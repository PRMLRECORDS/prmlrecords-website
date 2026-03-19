/* ════════════════════════════════════════════════════
   PRML Records LLC — sheets-fetcher.js
   Google Sheets CMS Integration
   
   SETUP: Replace SHEET_ID with your Google Sheet ID
   Found in the URL: docs.google.com/spreadsheets/d/SHEET_ID/edit
   
   Your sheet needs these tabs:
   - "Services" (name, category, price, description, imageUrl, active)
   - "Products" (name, category, price, description, imageUrl, active)
   - "Testimonials" (name, role, text, rating, approved, date)
   - "FAQ" (question, answer, category, active)
════════════════════════════════════════════════════ */

const SHEET_ID = '10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA';
const API_KEY  = 'PASTE_YOUR_GOOGLE_SHEETS_API_KEY_HERE';

// Sheets: open File > Share > Publish to Web first, OR use API key
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;

async function fetchSheet(tabName) {
  try {
    const url = `${BASE}/${encodeURIComponent(tabName)}?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const [headers, ...rows] = json.values || [];
    if (!headers) return [];
    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h.toLowerCase().trim()] = row[i] || '');
      return obj;
    });
  } catch (err) {
    console.warn(`Could not fetch sheet "${tabName}":`, err.message);
    return null; // null = error, [] = empty
  }
}

/* ── RENDER HELPERS ────────────────────────────── */
function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(containerId, msg = 'Could not load content. Please refresh or contact us.') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div style="padding:24px;font-family:'Roboto Slab',serif;font-size:14px;font-weight:300;color:var(--red);opacity:.8">${msg}</div>`;
}

/* ── TESTIMONIALS ──────────────────────────────── */
async function loadTestimonials(containerId = 'testi-container') {
  showLoading(containerId);
  const rows = await fetchSheet('Testimonials');
  const el = document.getElementById(containerId);
  if (!el) return;

  if (rows === null) { showError(containerId); return; }

  const approved = rows.filter(r => r.approved?.toLowerCase() === 'true');
  if (approved.length === 0) {
    el.innerHTML = '<div style="padding:24px;font-family:\'Roboto Slab\',serif;font-size:14px;opacity:.5">No testimonials yet.</div>';
    return;
  }

  el.innerHTML = `<div class="testi-grid">${approved.map(r => `
    <div class="testi-card rev">
      <div class="testi-stars">${'★'.repeat(parseInt(r.rating)||5)}</div>
      <div class="testi-text">"${r.text}"</div>
      <div class="testi-name">${r.name}</div>
      <div class="testi-role">${r.role}</div>
    </div>
  `).join('')}</div>`;

  // Re-init reveal for dynamically added cards
  document.querySelectorAll('#'+containerId+' .rev').forEach(el => {
    const ro = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
    }, { threshold: 0.07 });
    ro.observe(el);
  });
}

/* ── SERVICES / PRODUCTS BY CATEGORY ──────────── */
async function loadProducts(containerId, category, tabName = 'Products') {
  showLoading(containerId);
  const rows = await fetchSheet(tabName);
  const el = document.getElementById(containerId);
  if (!el) return;

  if (rows === null) { showError(containerId); return; }

  const filtered = rows.filter(r =>
    r.active?.toLowerCase() !== 'false' &&
    (!category || r.category?.toLowerCase() === category.toLowerCase())
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div style="padding:24px;font-family:\'Roboto Slab\',serif;font-size:14px;opacity:.5">No items in this category yet.</div>';
    return;
  }

  el.innerHTML = `<div class="card-grid">${filtered.map(r => `
    <div class="card">
      ${r.imageurl ? `<img src="${r.imageurl}" alt="${r.name}" style="width:100%;height:180px;object-fit:cover;margin-bottom:20px">` : `<div class="card__icon">🎨</div>`}
      <div class="card__title">${r.name}</div>
      <div class="card__desc">${r.description}</div>
      <div class="card__price">${r.price ? 'From $'+r.price : 'Contact for quote'}</div>
      <button class="btn btn--red btn--sm" style="margin-top:16px;width:100%;justify-content:center"
        onclick="addToCart({name:'${r.name.replace(/'/g,"\\'")}',price:'${r.price}',desc:'${r.description.slice(0,60).replace(/'/g,"\\'")}...'})">
        Add to Cart
      </button>
    </div>
  `).join('')}</div>`;
}

/* ── FAQ FROM SHEET ────────────────────────────── */
async function loadFAQ(containerId, category = '') {
  showLoading(containerId);
  const rows = await fetchSheet('FAQ');
  const el = document.getElementById(containerId);
  if (!el) return;

  if (rows === null) { showError(containerId); return; }

  const filtered = rows.filter(r =>
    r.active?.toLowerCase() !== 'false' &&
    (!category || r.category?.toLowerCase() === category.toLowerCase())
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div style="padding:24px;font-family:\'Roboto Slab\',serif;font-size:14px;opacity:.5">No FAQ items yet.</div>';
    return;
  }

  el.innerHTML = `<div class="faq-list">${filtered.map((r, i) => `
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFAQ(this)">
        <span>${r.question}</span>
        <span class="faq-icon">+</span>
      </div>
      <div class="faq-a">${r.answer}</div>
    </div>
  `).join('')}</div>`;
}

function toggleFAQ(q) {
  const isOpen = q.classList.contains('open');
  document.querySelectorAll('.faq-q').forEach(x => {
    x.classList.remove('open');
    x.nextElementSibling?.classList.remove('open');
  });
  if (!isOpen) {
    q.classList.add('open');
    q.nextElementSibling?.classList.add('open');
  }
}

// Export for use
window.SheetsCMS = { loadTestimonials, loadProducts, loadFAQ, fetchSheet };

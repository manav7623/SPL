// SPL 2026 Admin Dashboard client logic

let currentPage = 1;
const limit = 10;
let searchTimeout = null;

// Token helpers for persistent authentication across page refreshes
function getAdminToken() {
  return localStorage.getItem('spl_admin_token') || '';
}

function setAdminToken(token) {
  if (token) {
    localStorage.setItem('spl_admin_token', token);
  }
}

function clearAdminToken() {
  localStorage.removeItem('spl_admin_token');
}

// Authenticated fetch wrapper that sends the token on all requests
async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = options.headers ? { ...options.headers } : {};
  if (token) {
    headers['x-admin-token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, credentials: 'include', headers });
  if (response.status === 401) {
    clearAdminToken();
    showLogin();
  }
  return response;
}

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initLoginHandler();
  initDashboardControls();
});

// Admin Toast Helper
function showAdminToast(message, type = 'success') {
  const toast = document.getElementById('admin-toast-wrapper');
  const icon = document.getElementById('admin-toast-icon');
  const msgText = document.getElementById('admin-toast-message');

  msgText.innerText = message;
  toast.className = `toast-notification show ${type}`;

  if (type === 'success') {
    icon.className = 'fa-solid fa-circle-check';
  } else {
    icon.className = 'fa-solid fa-triangle-exclamation';
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Verification of active session (Persists on Refresh)
async function checkSession() {
  const token = getAdminToken();

  // If token is in localStorage, open dashboard immediately without asking for login!
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  try {
    const res = await adminFetch('/api/admin/check-session');
    const data = await res.json();

    if (data.authenticated) {
      showDashboard();
    } else {
      clearAdminToken();
      showLogin();
    }
  } catch (error) {
    console.error('Session check failed:', error);
    if (!token) {
      showLogin();
    }
  }
}

// Show/Hide page components
function showDashboard() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('dashboard-container').style.display = 'block';
  loadDashboardData();
}

function showLogin() {
  document.getElementById('login-container').style.display = 'block';
  document.getElementById('dashboard-container').style.display = 'none';
}

// Initialize Login form listener
function initLoginHandler() {
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showAdminToast('Please fill out all credentials.', 'error');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Persist token for seamless auto-login on refresh
      if (data.token) {
        setAdminToken(data.token);
      }

      showAdminToast('Welcome back, Admin.');
      showDashboard();
      
      // Clear password field
      document.getElementById('password').value = '';
    } catch (err) {
      showAdminToast(err.message, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Authenticate';
    }
  });
}

// Load metrics stats and player grid tables
function loadDashboardData() {
  fetchStats();
  fetchPlayers();
}

// Fetch general stats cards
async function fetchStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    if (!res.ok) throw new Error('Failed to retrieve statistics.');
    
    const stats = await res.json();

    document.getElementById('stat-total').innerText = stats.totalRegistrations;
    document.getElementById('stat-paid').innerText = stats.paidRegistrations;
    
    const pendingFailed = stats.totalRegistrations - stats.paidRegistrations;
    document.getElementById('stat-pending').innerText = pendingFailed;
    
    // Format collection in Rupees currency layout
    const formattedAmt = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(stats.totalCollection);

    document.getElementById('stat-collection').innerText = formattedAmt;

  } catch (error) {
    console.error('Stats loading error:', error);
  }
}

// Fetch players table rows
async function fetchPlayers() {
  const tbody = document.getElementById('players-tbody');
  
  // Show table loader
  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 40px;">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
      </td>
    </tr>
  `;

  const searchVal = document.getElementById('search-input').value.trim();
  const roleVal = document.getElementById('filter-role').value;
  const statusVal = document.getElementById('filter-status').value;

  try {
    const url = `/api/admin/players?search=${encodeURIComponent(searchVal)}&role=${roleVal}&status=${statusVal}&page=${currentPage}&limit=${limit}`;
    const res = await adminFetch(url);
    if (!res.ok) throw new Error('Failed to retrieve players.');

    const data = await res.json();

    if (data.players.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-gray);">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            No registration records found matching the current search parameters.
          </td>
        </tr>
      `;
      updatePagination(0);
      return;
    }

    tbody.innerHTML = '';
    data.players.forEach(p => {
      const row = document.createElement('tr');
      
      // Status badge builder
      let statusClass = 'pending';
      if (p.payment_status === 'Paid') statusClass = 'paid';
      if (p.payment_status === 'Failed') statusClass = 'failed';

      const regId = p.registration_id || '<span style="color: var(--text-muted); font-size: 0.8rem;">PENDING PAYMENT</span>';
      
      // UTR / Payment ID display
      let utrDisplay = '<span style="color: var(--text-muted);">—</span>';
      if (p.utr_number) {
        utrDisplay = `
          <div style="display: inline-flex; align-items: center; gap: 5px;">
            <span style="font-family: monospace; font-weight: 700; color: #38bdf8; font-size: 0.85rem; letter-spacing: 0.5px;">${escapeHtml(p.utr_number)}</span>
            <button type="button" title="Copy UTR" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; cursor: pointer;" onclick="navigator.clipboard.writeText('${escapeHtml(p.utr_number)}'); showAdminToast('UTR copied to clipboard!');">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        `;
      } else if (p.razorpay_payment_id) {
        utrDisplay = `<span style="font-family: monospace; font-size: 0.85rem; color: var(--text-gray);">${escapeHtml(p.razorpay_payment_id)}</span>`;
      }
      
      // Action buttons (Approve / Reject)
      let actionButtons = '';
      if (p.payment_status === 'Paid') {
        actionButtons = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #4ade80; font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Verified</span>
            <button type="button" title="Reject / Revoke" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; cursor: pointer;" onclick="changePlayerStatus(${p.id}, 'Failed')">
              <i class="fa-solid fa-ban"></i>
            </button>
          </div>
        `;
      } else if (p.payment_status === 'Pending') {
        actionButtons = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" style="padding: 4px 10px; font-size: 0.75rem; background: #16a34a; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;" onclick="changePlayerStatus(${p.id}, 'Paid')">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button type="button" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; cursor: pointer;" onclick="changePlayerStatus(${p.id}, 'Failed')">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </div>
        `;
      } else {
        // Failed
        actionButtons = `
          <button type="button" style="padding: 4px 10px; font-size: 0.75rem; background: #16a34a; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;" onclick="changePlayerStatus(${p.id}, 'Paid')">
            <i class="fa-solid fa-check"></i> Approve
          </button>
        `;
      }

      // Date formatting for Indian timezone
      const regDate = new Date(p.created_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      row.innerHTML = `
        <td style="font-weight: 700; color: var(--accent);">${regId}</td>
        <td style="font-weight: 600;">${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.mobile)}</td>
        <td><i class="fa-solid ${getRoleIcon(p.playing_role)}" style="margin-right: 5px; color: var(--primary);"></i> ${p.playing_role}</td>
        <td>
          <span style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.2); padding: 2px 6px; border-radius: 4px; font-weight: bold; color: var(--accent); margin-right: 5px;">${p.tshirt_size}</span>
          #${p.tshirt_number} &nbsp;<span style="color: var(--text-gray); font-style: italic;">"${escapeHtml(p.tshirt_name)}"</span>
        </td>
        <td><span class="status-badge ${statusClass}">${p.payment_status}</span></td>
        <td>${utrDisplay}</td>
        <td style="font-size: 0.85rem; color: var(--text-gray);">${regDate}</td>
        <td>${actionButtons}</td>
      `;

      tbody.appendChild(row);
    });

    updatePagination(data.totalCount);

  } catch (error) {
    console.error('Players loading error:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--error);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
          Error loading registration database directory. Please check server connection.
        </td>
      </tr>
    `;
  }
}

// Update player payment status (Approve as Paid, or Reject as Failed)
async function changePlayerStatus(id, newStatus) {
  const confirmMsg = newStatus === 'Paid'
    ? 'Are you sure you want to APPROVE this registration as Paid?'
    : 'Are you sure you want to REJECT this registration?';

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/players/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update player status.');
    }

    showAdminToast(`Registration status updated to ${newStatus}.`);
    fetchStats();
    fetchPlayers();
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}
window.changePlayerStatus = changePlayerStatus;

// Utility to get FontAwesome icon class per player role
function getRoleIcon(role) {
  switch (role) {
    case 'Batsman': return 'fa-baseball-bat-ball';
    case 'Bowler': return 'fa-baseball';
    case 'All-rounder': return 'fa-arrows-spin';
    case 'Wicket Keeper/Batsman': return 'fa-hand-holding-box';
    default: return 'fa-user';
  }
}

// Simple HTML escaping to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Update Pagination button states and captions
function updatePagination(totalCount) {
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const label = document.getElementById('pagination-label');

  if (totalCount === 0) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    label.innerText = 'Showing 0-0 of 0 registrations';
    return;
  }

  const startIdx = (currentPage - 1) * limit + 1;
  const endIdx = Math.min(currentPage * limit, totalCount);

  label.innerText = `Showing ${startIdx}-${endIdx} of ${totalCount} registrations`;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = endIdx >= totalCount;
}

// Initialize input filters, search, buttons, and logout
function initDashboardControls() {
  const searchInput = document.getElementById('search-input');
  const filterRole = document.getElementById('filter-role');
  const filterStatus = document.getElementById('filter-status');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const exportBtn = document.getElementById('export-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // Debounced search typing listener
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      fetchPlayers();
    }, 450);
  });

  // Filter dropdown listeners
  filterRole.addEventListener('change', () => {
    currentPage = 1;
    fetchPlayers();
  });

  filterStatus.addEventListener('change', () => {
    currentPage = 1;
    fetchPlayers();
  });

  // Pagination navigation listeners
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchPlayers();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    fetchPlayers();
  });

  // Excel Export download trigger
  exportBtn.addEventListener('click', () => {
    const token = getAdminToken();
    window.location.href = `/api/admin/export?token=${encodeURIComponent(token)}`;
  });

  // Logout listener
  logoutBtn.addEventListener('click', async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error(error);
    } finally {
      clearAdminToken();
      showAdminToast('Signed out successfully.');
      showLogin();
    }
  });
}
